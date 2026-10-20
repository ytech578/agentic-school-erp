/**
 * Offline Authentik backup and isolated database/volume recovery acceptance.
 * Requires stopped server/worker; restores the source DB's original stopped state.
 * Never starts a restored worker, publishes ports, or reconnects integrations.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { encryptArchive, decryptArchive } = require('./neon-backup');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'backups/identity-recovery');
const limit = 128 * 1024 * 1024;
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
function docker(args, input, env = process.env) {
  const result = spawnSync('docker', args, {
    input, env, windowsHide: true, maxBuffer: limit, timeout: 180000,
  });
  // Docker diagnostics can contain environment values; do not echo them.
  if (result.error || result.status !== 0) {
    const operation = ['pg_dump', 'pg_restore', 'pg_isready', 'tar'].find((item) => args.includes(item));
    const safeLoginError = result.stderr?.toString().match(/^Isolated recovery login failed: ([A-Za-z0-9 -]+)$/m);
    if (safeLoginError) throw new Error(`Restored login failed: ${safeLoginError[1]}`);
    throw new Error(`Docker ${args[0]}${operation ? ' ' + operation : ''} failed; private diagnostics withheld`);
  }
  return result.stdout;
}
function inspect(name) { return JSON.parse(docker(['inspect', name]).toString())[0]; }
function variables(container) {
  return Object.fromEntries(container.Config.Env.map((entry) => {
    const index = entry.indexOf('=');
    return [entry.slice(0, index), entry.slice(index + 1)];
  }));
}
function canonicalDump(buffer) {
  return buffer.toString('utf8').split('\n')
    .filter((line) => !/^\\(?:un)?restrict /.test(line)).join('\n');
}
function dump(container, user, database, custom = false) {
  return docker(['exec', container, 'pg_dump', '-U', user, '-d', database,
    '--no-owner', '--no-acl', ...(custom ? ['-Fc'] : [])]);
}
function entry(buffer) {
  return { sha256: sha(buffer), base64: buffer.toString('base64') };
}
function decode(item) {
  if (!item || typeof item.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(item.base64)) throw new Error('Invalid archive entry');
  const data = Buffer.from(item.base64, 'base64');
  if (sha(data) !== item.sha256) throw new Error('Archive entry integrity failed');
  return data;
}
function tarInventory(buffer) {
  // Compare files and POSIX metadata, not tar entry order or user-name aliases.
  // Accept only simple ustar archives emitted by this tool; fail closed on
  // extensions, device nodes, duplicate paths, and writes through symlinks.
  const files = [], seen = new Set();
  const text = (block, start, length) => block.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
  const octal = (block, start, length) => {
    const value = text(block, start, length).trim();
    if (!/^[0-7]+$/.test(value)) throw new Error('Unsupported tar numeric format');
    return parseInt(value, 8);
  };
  const safePath = (value) => {
    if (!value || value.includes('\\') || value.startsWith('/') || value.split('/').includes('..')) throw new Error('Unsafe tar path');
    return path.posix.normalize(value).replace(/\/$/, '') || '.';
  };
  for (let offset = 0; offset < buffer.length; ) {
    if (offset + 512 > buffer.length) throw new Error('Truncated tar header');
    const block = buffer.subarray(offset, offset + 512);
    if (block.every((byte) => byte === 0)) {
      if (!buffer.subarray(offset).every((byte) => byte === 0)) throw new Error('Unexpected tar trailer');
      for (const link of files.filter((f) => f.type === '2')) {
        if (files.some((f) => f.name.startsWith(link.name + '/'))) throw new Error('Tar writes through a symlink');
      }
      return files.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    }
    const checksum = block.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (checksum !== octal(block, 148, 8)) throw new Error('Tar header checksum failed');
    const prefix = text(block, 345, 155);
    const name = safePath((prefix ? prefix + '/' : '') + text(block, 0, 100));
    const type = text(block, 156, 1) || '0';
    if (!['0', '2', '5'].includes(type) || seen.has(name)) throw new Error('Unsupported or duplicate tar entry');
    seen.add(name);
    const size = octal(block, 124, 12);
    const start = offset + 512;
    if (start + size > buffer.length) throw new Error('Truncated tar data');
    const link = text(block, 157, 100);
    if (type === '2') {
      // Authentik ships a /data/media -> /media compatibility link. Preserve
      // leaf links without following them; reject any archive writing under one.
      safePath(link.replace(/^\//, ''));
    }
    files.push({ name, type, mode: octal(block, 100, 8), uid: octal(block, 108, 8),
      gid: octal(block, 116, 8), size, link,
      sha256: sha(buffer.subarray(start, start + size)) });
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new Error('Missing tar terminator');
}
function validateBundle(bundle) {
  if (bundle.version !== 1 || !/^[a-z0-9][a-z0-9_-]{1,62}$/.test(bundle.project || '')) throw new Error('Invalid recovery bundle');
  if (!/^sha256:[a-f0-9]{64}$/.test(bundle.databaseImage || '') ||
      !/^sha256:[a-f0-9]{64}$/.test(bundle.identityImage || '')) throw new Error('Missing immutable image identities');
  if (!/^[a-f0-9]{64}$/.test(bundle.databaseLogicalHash || '') ||
      typeof bundle.secretKey !== 'string' || bundle.secretKey.length < 32) throw new Error('Missing identity recovery metadata');
  if (!Array.isArray(bundle.volumes) || bundle.volumes.length !== 3 ||
      new Set(bundle.volumes.map((v) => v.target)).size !== 3 ||
      bundle.volumes.some((v) => !['/data', '/templates', '/certs'].includes(v.target))) throw new Error('Unexpected recovery volume inventory');
  decode(bundle.database);
  bundle.volumes.forEach((v) => tarInventory(decode(v.archive)));
  return bundle;
}
async function ready(container, user, database) {
  for (let attempt = 0; attempt < 45; attempt++) {
    try {
      // Official PostgreSQL images briefly accept connections on an initialization
      // server, then restart. Wait for the final PID-1 server before restoring.
      docker(['exec', container, 'sh', '-c',
        'test "$(cat /proc/1/comm)" = postgres && pg_isready -U "$1" -d "$2"',
        'identity-ready', user, database]);
      return;
    }
    catch { await new Promise((resolve) => setTimeout(resolve, 1000)); }
  }
  throw new Error('Recovery database did not become ready');
}
function sourceContainers(project) {
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(project)) throw new Error('Invalid Compose project');
  const ids = docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`])
    .toString().trim().split(/\s+/).filter(Boolean);
  const containers = ids.map(inspect);
  const pick = (service) => {
    const matches = containers.filter((c) => c.Config.Labels['com.docker.compose.service'] === service);
    if (matches.length !== 1) throw new Error(`Expected one ${service} container`);
    return matches[0];
  };
  const server = pick('server'), worker = pick('worker'), db = pick('identity-db');
  if (server.State.Running || worker.State.Running) throw new Error('Stop the identity server and worker before a consistent offline backup');
  return { server, worker, db };
}
function archiveVolume(image, volume) {
  return docker(['run', '--rm', '--pull=never', '--network=none', '--memory=64m', '--cpus=0.25',
    '--read-only', '--security-opt=no-new-privileges', '--mount', `type=volume,src=${volume},dst=/source,readonly`,
    '--entrypoint', 'tar', image, '-C', '/source', '-cf', '-', '.']);
}
async function backup(key, project) {
  const { server, worker, db } = sourceContainers(project);
  const dbEnv = variables(db), serverEnv = variables(server), workerEnv = variables(worker);
  if (server.Image !== worker.Image || serverEnv.AUTHENTIK_SECRET_KEY !== workerEnv.AUTHENTIK_SECRET_KEY) throw new Error('Identity server/worker configuration mismatch');
  const mounts = ['/data', '/templates', '/certs'].map((target) => {
    const mount = (target === '/certs' ? worker : server).Mounts.find((m) => m.Destination === target);
    if (!mount || mount.Type !== 'volume') throw new Error('This recovery tool requires the supplied named-volume layout');
    // Prevent silently omitting unknown persistent application data.
    return { target, name: mount.Name };
  });
  for (const container of [server, worker]) {
    if (container.Mounts.some((m) => !mounts.some((v) => v.target === m.Destination && v.name === m.Name))) {
      throw new Error('Unrecognized identity mount; extend backup inventory before proceeding');
    }
  }
  const started = !db.State.Running;
  try {
    if (started) docker(['start', db.Id]);
    await ready(db.Id, dbEnv.POSTGRES_USER || 'postgres', dbEnv.POSTGRES_DB);
    const user = dbEnv.POSTGRES_USER || 'postgres';
    const imageReferences = (id) => inspect(id).RepoDigests || [];
    const bundle = {
      version: 1, createdAt: new Date().toISOString(), project,
      databaseImage: db.Image, identityImage: server.Image,
      databaseImageReferences: imageReferences(db.Image), identityImageReferences: imageReferences(server.Image),
      secretKey: serverEnv.AUTHENTIK_SECRET_KEY,
      database: entry(dump(db.Id, user, dbEnv.POSTGRES_DB, true)),
      databaseLogicalHash: sha(canonicalDump(dump(db.Id, user, dbEnv.POSTGRES_DB))),
      volumes: mounts.map((v) => ({ target: v.target, archive: entry(archiveVolume(db.Image, v.name)) })),
    };
    validateBundle(bundle);
    const plain = Buffer.from(JSON.stringify(bundle));
    if (plain.length > limit) throw new Error('Backup exceeds 128 MiB local-tool limit; use a streaming production backup service');
    const encrypted = encryptArchive(plain, key);
    if (!decryptArchive(encrypted, key).equals(plain)) throw new Error('Backup encryption verification failed');
    const destination = path.join(directory, `identity-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.enc`);
    fs.writeFileSync(destination, encrypted, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ encryptedArchive: destination, sha256: sha(encrypted),
      sourceProject: project, volumes: bundle.volumes.length, independentCopy: false }));
    return destination;
  } finally {
    if (started) docker(['stop', '--time', '30', db.Id]);
  }
}
async function drill(bundle, archiveHash) {
  // This exact name and label belong only to this invocation, never a source.
  const name = `erp-identity-drill-${crypto.randomBytes(10).toString('hex')}`;
  const volumes = [];
  let created = false;
  let serverCreated = false;
  const serverName = name + '-server';
  const startedAt = Date.now();
  try {
    docker(['image', 'inspect', bundle.databaseImage]);
    const password = crypto.randomBytes(32).toString('hex');
    docker(['run', '-d', '--pull=never', '--name', name, '--label', `erp.identity.drill=${name}`,
      '--network=none', '--memory=256m', '--cpus=0.5',
      '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER=authentik', '-e', 'POSTGRES_DB=authentik',
      bundle.databaseImage], undefined, { ...process.env, POSTGRES_PASSWORD: password });
    created = true;
    await ready(name, 'authentik', 'authentik');
    docker(['exec', '-i', name, 'pg_restore', '-U', 'authentik', '-d', 'authentik',
      '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction'], decode(bundle.database));
    if (sha(canonicalDump(dump(name, 'authentik', 'authentik'))) !== bundle.databaseLogicalHash) {
      throw new Error('Restored database schema/data do not match the source dump');
    }
    for (let index = 0; index < bundle.volumes.length; index++) {
      const volume = `${name}-files-${index}`;
      docker(['volume', 'create', '--label', `erp.identity.drill=${name}`, volume]);
      volumes.push(volume);
      docker(['run', '--rm', '-i', '--pull=never', '--network=none', '--memory=64m', '--cpus=0.25',
        '--security-opt=no-new-privileges', '--mount', `type=volume,src=${volume},dst=/restore`,
        '--entrypoint', 'tar', bundle.databaseImage, '--numeric-owner', '-C', '/restore', '-xpf', '-'],
      decode(bundle.volumes[index].archive));
      const expected = tarInventory(decode(bundle.volumes[index].archive));
      // BusyBox extraction can retain the newly created volume root's owner and
      // assign symlinks to root. Explicit lchown preserves numeric ownership,
      // including the mount root; -h never follows the compatibility symlink.
      const ownership = new Map();
      for (const file of expected) {
        const owner = `${file.uid}:${file.gid}`;
        if (!ownership.has(owner)) ownership.set(owner, []);
        ownership.get(owner).push(`/restore/${file.name}`);
      }
      for (const [owner, names] of ownership) {
        for (let offset = 0; offset < names.length; offset += 64) {
          docker(['run', '--rm', '--pull=never', '--network=none', '--memory=64m',
            '--read-only', '--security-opt=no-new-privileges',
            '--mount', `type=volume,src=${volume},dst=/restore`, '--entrypoint', 'chown',
            bundle.databaseImage, '-h', owner, ...names.slice(offset, offset + 64)]);
        }
      }
      const actual = tarInventory(archiveVolume(bundle.databaseImage, volume));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        const fields = new Set();
        for (let row = 0; row < Math.max(expected.length, actual.length); row++) {
          for (const field of ['name', 'type', 'mode', 'uid', 'gid', 'size', 'link', 'sha256']) {
            if (expected[row]?.[field] !== actual[row]?.[field]) fields.add(field);
          }
        }
        throw new Error(`Restored identity files do not match: volume ${index}, fields ${[...fields].join(',')}`);
      }
    }
    let login = null;
    if (process.argv.includes('--synthetic-login')) {
      if (bundle.project !== 'school-erp-identity') throw new Error('Synthetic login requires the local test project');
      if (require('node:os').freemem() < 2 * 1024 ** 3) throw new Error('At least 2 GiB free host memory required for the optional restored login check');
      docker(['image', 'inspect', bundle.identityImage]);
      const state = JSON.parse(fs.readFileSync(path.join(root, 'backups/identity/authentik-fixture.json')));
      const secrets = JSON.parse(fs.readFileSync(path.join(root, 'backups/identity/development-secrets.json')));
      const mountArgs = bundle.volumes.flatMap((v, index) => ['--mount', `type=volume,src=${volumes[index]},dst=${v.target}`]);
      docker(['run', '-d', '--pull=never', '--name', serverName, '--label', `erp.identity.drill=${name}`,
        '--network', `container:${name}`, '--memory=1024m', '--memory-swap=1024m', '--cpus=1',
        '-e', 'AUTHENTIK_SECRET_KEY', '-e', 'AUTHENTIK_POSTGRESQL__PASSWORD',
        '-e', 'AUTHENTIK_POSTGRESQL__HOST=127.0.0.1', '-e', 'AUTHENTIK_POSTGRESQL__USER=authentik',
        '-e', 'AUTHENTIK_POSTGRESQL__NAME=authentik', '-e', 'AUTHENTIK_ERROR_REPORTING__ENABLED=false',
        '-e', 'AUTHENTIK_DISABLE_STARTUP_ANALYTICS=true', ...mountArgs, bundle.identityImage, 'server'],
      undefined, { ...process.env, AUTHENTIK_SECRET_KEY: bundle.secretKey, AUTHENTIK_POSTGRESQL__PASSWORD: password });
      serverCreated = true;
      let healthy = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          docker(['exec', serverName, 'python', '-c',
            "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9000/-/health/ready/', timeout=3).read()"]);
          healthy = true; break;
        } catch { await new Promise((resolve) => setTimeout(resolve, 1000)); }
      }
      if (!healthy) throw new Error('Restored identity server did not become ready');
      const loginScript = fs.readFileSync(path.join(__dirname, 'identity-restore-login.py'), 'utf8');
      login = JSON.parse(docker(['exec', '-i', serverName, 'python', '-c', loginScript],
        JSON.stringify({ slug: state.slug, email: state.email, totpSecret: state.totpSecret, password: secrets.fixturePassword })));
      if (login.restoredPasswordAndTotpLogin !== true || login.missingMfaDenied !== true) throw new Error('Restored MFA acceptance incomplete');
    }
    return { verifiedAt: new Date().toISOString(), sourceProject: bundle.project,
      archiveSha256: archiveHash, backupCreatedAt: bundle.createdAt,
      databaseSchemaAndDataMatched: true, volumesMatched: volumes.length,
      originalSecretKeyRecovered: true, exactImageRecorded: true,
      outboundNetworkBlocked: true, portsPublished: false,
      runtimeLoginAfterRestoreTested: Boolean(login), restoredLogin: login, productionAccepted: false,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000) };
  } finally {
    // Remove only owned, disposable drill resources; encrypted backup is retained.
    // Try every cleanup even if one removal fails.
    const failures = [];
    if (serverCreated) {
      try {
        if (inspect(serverName).Config.Labels['erp.identity.drill'] !== name) throw new Error('Drill ownership changed');
        docker(['rm', '-f', serverName]);
      } catch { failures.push('identity server'); }
    }
    if (created) {
      try {
        if (inspect(name).Config.Labels['erp.identity.drill'] !== name) throw new Error('Drill ownership changed');
        docker(['rm', '-f', '-v', name]);
      } catch { failures.push('database'); }
    }
    for (const volume of volumes) {
      try {
        if (JSON.parse(docker(['volume', 'inspect', volume]))[0].Labels['erp.identity.drill'] !== name) throw new Error('Volume ownership changed');
        docker(['volume', 'rm', volume]);
      } catch { failures.push('volume'); }
    }
    if (failures.length) throw new Error(`Drill cleanup incomplete; inspect resources with label erp.identity.drill=${name}`);
  }
}
async function main() {
  fs.mkdirSync(directory, { recursive: true });
  const keyFile = process.env.IDENTITY_BACKUP_KEY_FILE;
  if (!keyFile || !path.isAbsolute(keyFile)) throw new Error('Set IDENTITY_BACKUP_KEY_FILE to an absolute operator-controlled key path');
  const mode = process.argv[2];
  if (mode === 'init-key') {
    fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex') + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Recovery key created without replacing any existing key. Keep an independent protected copy.');
    return;
  }
  const keyText = fs.readFileSync(keyFile, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(keyText)) throw new Error('Invalid recovery key');
  const key = Buffer.from(keyText, 'hex');
  if (mode === 'backup') return backup(key, process.env.IDENTITY_COMPOSE_PROJECT || 'school-erp-identity');
  if (!['verify', 'drill'].includes(mode) || !process.argv[3]) throw new Error('Use init-key, backup, verify <archive>, or drill <archive>');
  const archive = path.resolve(process.argv[3]);
  if (fs.statSync(archive).size > limit + 35) throw new Error('Archive exceeds local-tool limit');
  const encrypted = fs.readFileSync(archive);
  const bundle = validateBundle(JSON.parse(decryptArchive(encrypted, key)));
  if (mode === 'verify') {
    console.log(JSON.stringify({ authenticated: true, entriesVerified: 4, restoreExecuted: false }));
    return;
  }
  const report = await drill(bundle, sha(encrypted));
  const reportPath = archive + `.drill-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ ...report, disposableResourcesRemoved: true }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ ...report, disposableResourcesRemoved: true, report: reportPath }));
}
module.exports = { canonicalDump, validateBundle, entry, decode, tarInventory };
if (require.main === module) main().catch((error) => {
  // Only locally authored errors are emitted. Parser errors may contain secret content.
  console.error(error instanceof SyntaxError ? 'Recovery metadata is invalid' : error.message);
  process.exitCode = 1;
});
