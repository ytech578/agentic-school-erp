'use strict';
// Same-host data recovery acceptance, never a production/second-host cutover.
// The restored server receives only dump bytes over stdin: no source URL or key.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { validateConfig, loadArchive, validateTables, inventorySql } = require('./scheduled-neon-backup');
const { atomicJson, readEnv } = require('./scheduled-identity-backup');
const { filename, validateManifest } = require('./neon-backup-transport');
const purposes = ['probe', 'fetch', 'server'];
const s3Keys = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET_NAME', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function failureCode(stderr) {
  if (/role .+ does not exist/i.test(stderr || '')) return 'RESTORE_ROLE_REFERENCE_MISSING';
  if (/extension .+ is not available|could not open extension control file/i.test(stderr || '')) return 'RESTORE_EXTENSION_UNAVAILABLE';
  if (/out of memory|cannot allocate memory|no space left on device/i.test(stderr || '')) return 'RESTORE_RESOURCE_LIMIT';
  if (/database .+ does not exist|server closed the connection|shutting down|starting up|connection refused/i.test(stderr || '')) return 'RESTORE_TARGET_NOT_READY';
  if (/schema .+ already exists/i.test(stderr || '')) return 'RESTORE_SCHEMA_ALREADY_EXISTS';
  if (/unrecognized configuration parameter/i.test(stderr || '')) return 'RESTORE_UNSUPPORTED_SETTING';
  if (/permission denied|must be owner|must be member of role/i.test(stderr || '')) return 'RESTORE_PERMISSION_DENIED';
  if (/function .+ does not exist|type .+ does not exist/i.test(stderr || '')) return 'RESTORE_SCHEMA_REFERENCE_MISSING';
  return 'ISOLATED_COMMAND_FAILED';
}
function privateFile(file) {
  const s = fs.lstatSync(file);
  assert(s.isFile() && !s.isSymbolicLink() && s.nlink === 1);
  if (process.platform === 'linux') assert(s.uid === 0 && !(s.mode & 0o077));
}
function privateDirectory(dir) {
  const s = fs.lstatSync(dir);
  assert(s.isDirectory() && !s.isSymbolicLink());
  if (process.platform === 'linux') assert(s.uid === 0 && !(s.mode & 0o077));
}
function planFor(c, runId) {
  assert.match(runId, /^[a-f0-9]{16}$/);
  const name = `erp-neon-restore-${runId}`;
  return { version: 1, project: c.project, runId, name,
    directory: path.join(c.stateDirectory, 'recovery-drills', runId),
    postgresImage: c.postgresImage, dependencyImage: c.dependencyImage };
}
function validatePlan(p, c) {
  assert.deepEqual(p, planFor(c, p.runId));
  return p;
}
function command(args, { input, env = {}, timeout = 30000, limit = 2 * 1024 * 1024 } = {}) {
  const r = spawnSync(args[0], args.slice(1), { input, env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8', timeout, maxBuffer: limit });
  if (r.error || r.status !== 0) throw new Error(failureCode(r.stderr));
  return r.stdout;
}
function commonArgs(p, purpose, image) {
  assert(purposes.includes(purpose));
  assert.match(image, /^sha256:[a-f0-9]{64}$/);
  return ['run', '--pull=never', '--name', `${p.name}-${purpose}`,
    '--label', `com.school-erp.restore.run=${p.runId}`, '--label', `com.school-erp.restore.purpose=${purpose}`,
    '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--log-driver=none',
    '--memory=1g', '--memory-swap=1g', '--cpus=1', '--pids-limit=128'];
}
function serverArgs(p, uid, gid) {
  for (const id of [uid, gid]) assert(Number.isInteger(id) && id > 0 && id <= 65534);
  return [...commonArgs(p, 'server', p.postgresImage), '-d', '--network=none', `--user=${uid}:${gid}`,
    '--tmpfs', `/var/lib/postgresql/data:rw,noexec,nosuid,size=512m,mode=0700,uid=${uid},gid=${gid}`,
    '--tmpfs', `/var/run/postgresql:rw,noexec,nosuid,size=16m,mode=0700,uid=${uid},gid=${gid}`,
    '--tmpfs', `/tmp:rw,noexec,nosuid,size=16m,mode=0700,uid=${uid},gid=${gid}`,
    '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=neon_restore',
    p.postgresImage, 'postgres', '-c', 'listen_addresses=', '-c', 'shared_buffers=32MB',
    '-c', 'max_connections=10', '-c', 'unix_socket_directories=/var/run/postgresql'];
}
function validateResource(d, p, purpose) {
  assert(purposes.includes(purpose));
  assert.equal(d.Name, `/${p.name}-${purpose}`);
  assert.equal(d.Image, purpose === 'fetch' ? p.dependencyImage : p.postgresImage);
  assert.equal(d.Config.Labels?.['com.school-erp.restore.run'], p.runId);
  assert.equal(d.Config.Labels?.['com.school-erp.restore.purpose'], purpose);
  assert.equal(d.HostConfig.ReadonlyRootfs, true);
  assert(!Object.keys(d.HostConfig.PortBindings || {}).length);
  assert.equal(d.HostConfig.Privileged, false);
  if (purpose !== 'fetch') {
    assert.equal(d.HostConfig.NetworkMode, 'none');
    // Docker may omit tmpfs from Mounts; HostConfig.Tmpfs is authoritative.
    assert(d.Mounts.every((m) => m.Type === 'tmpfs' &&
      ['/var/lib/postgresql/data', '/var/run/postgresql', '/tmp'].includes(m.Destination)));
    const tmpfs = d.HostConfig.Tmpfs || {};
    if (purpose === 'probe') {
      assert.deepEqual(tmpfs, { '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=1m' });
    } else {
      const ids = (d.Config.User || '').split(':').map(Number);
      assert(ids.length === 2 && ids.every((v) => Number.isInteger(v) && v > 0 && v <= 65534));
      const owner = ',mode=0700,uid=' + ids[0] + ',gid=' + ids[1];
      assert.deepEqual(tmpfs, {
        '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=512m' + owner,
        '/var/run/postgresql': 'rw,noexec,nosuid,size=16m' + owner,
        '/tmp': 'rw,noexec,nosuid,size=16m' + owner,
      });
    }
  } else {
    const allowed = new Map([
      ['/app/neon-backup-transport.js', { source: path.join(__dirname, 'neon-backup-transport.js'), rw: false }],
      ['/app/identity-backup-transport.js', { source: path.join(__dirname, 'identity-backup-transport.js'), rw: false }],
      ['/transfer', { source: path.join(p.directory, 'download'), rw: true }],
    ]);
    assert.equal(d.Mounts.length, allowed.size);
    for (const m of d.Mounts) {
      const expected = allowed.get(m.Destination);
      assert(expected && m.Type === 'bind' && m.Source === expected.source && m.RW === expected.rw);
    }
  }
  return d.Id;
}
function cleanup(p) {
  for (const purpose of purposes) {
    const name = `${p.name}-${purpose}`;
    const present = command(['docker', 'ps', '-aq', '--filter', `name=^/${name}$`]).trim();
    if (!present) continue;
    const d = JSON.parse(command(['docker', 'inspect', name]))[0];
    const id = validateResource(d, p, purpose);
    command(['docker', 'rm', '--force', id]); // Only this exact labelled, volume-free drill resource.
  }
}
function parseInventory(text) {
  const tables = text.split(/\r?\n/).filter(Boolean).map((line) => {
    const { type, ...table } = JSON.parse(line); assert.equal(type, 'table'); return table;
  });
  return validateTables(tables);
}
function compareInventory(actual, expected) {
  validateTables(expected); validateTables(actual);
  const sort = (xs) => xs.slice().sort((a, b) => JSON.stringify([a.schema, a.name]).localeCompare(JSON.stringify([b.schema, b.name])));
  assert.deepEqual(sort(actual), sort(expected));
  return expected.length;
}
function localSql(p, sql) {
  return command(['docker', 'exec', '-i', `${p.name}-server`, 'psql', '-X', '-q', '-A', '-t',
    '--set=ON_ERROR_STOP=on', '-h', '/var/run/postgresql', '-U', 'postgres', '-d', 'neon_restore'], { input: sql, timeout: 120000 });
}
async function drill(c, archiveName) {
  assert.match(archiveName, filename); privateDirectory(c.stateDirectory);
  const p = planFor(c, crypto.randomBytes(8).toString('hex'));
  const root = path.dirname(p.directory);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { mode: 0o700 });
  privateDirectory(root); fs.mkdirSync(p.directory, { mode: 0o700 });
  const planFile = path.join(p.directory, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify(p, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  const original = path.join(c.stateDirectory, 'archives', archiveName);
  privateFile(original); privateFile(original + '.json');
  const manifestBytes = fs.readFileSync(original + '.json');
  const m = validateManifest(manifestBytes, c.project, archiveName);
  assert.equal(sha(fs.readFileSync(original)), m.archive.sha256);
  // No source database connection file is read anywhere in the recovery path.
  const startedAt = new Date().toISOString(); let restored, watchdog = false, report, stage = 'WATCHDOG';
  try {
    command(['systemd-run', '--quiet', '--unit', p.name + '-cleanup', '--on-active=10m', '--timer-property=AccuracySec=1s',
      process.execPath, __filename, 'cleanup', '/etc/school-erp-neon-backup/config.json', planFile]); watchdog = true;
    stage = 'R2_DOWNLOAD';
    const download = path.join(p.directory, 'download'); fs.mkdirSync(download, { mode: 0o700 });
    fs.chownSync(download, 65532, 65532);
    const env = readEnv(c.storageEnvFile, s3Keys);
    const fetchArgs = [...commonArgs(p, 'fetch', p.dependencyImage), '-i', '--user=65532:65532',
      ...['neon-backup-transport.js', 'identity-backup-transport.js'].flatMap((n) => ['--mount', `type=bind,src=${path.join(__dirname, n)},dst=/app/${n},readonly`]),
      '--mount', `type=bind,src=${download},dst=/transfer`, ...Object.keys(env).flatMap((n) => ['-e', n]),
      '--entrypoint=node', p.dependencyImage, '/app/neon-backup-transport.js', 'download', c.project, archiveName];
    const remote = JSON.parse(command(['docker', ...fetchArgs], { env, timeout: 240000 }));
    assert.equal(remote.remoteCopyVerified, true); assert.equal(remote.recoveryKeyDownloaded, false);
    for (const suffix of ['', '.json']) {
      const file = path.join(download, archiveName + suffix), s = fs.lstatSync(file);
      assert(s.isFile() && !s.isSymbolicLink() && s.nlink === 1);
      fs.chownSync(file, 0, 0); fs.chmodSync(file, 0o600);
    }
    fs.chownSync(download, 0, 0); fs.chmodSync(download, 0o700);
    const recovered = path.join(download, archiveName);
    assert(fs.readFileSync(recovered + '.json').equals(manifestBytes));
    assert.equal(sha(fs.readFileSync(recovered)), m.archive.sha256);
    stage = 'AUTHENTICATE';
    restored = loadArchive(recovered, c); // Key stays in this host process, never in Docker.
    stage = 'ISOLATED_SERVER';
    const uidText = command(['docker', ...commonArgs(p, 'probe', p.postgresImage), '--network=none', '--user=65532:65532',
      '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=1m', '--entrypoint=sh', p.postgresImage,
      '-c', 'id -u postgres; id -g postgres']);
    const ids = uidText.trim().split(/\s+/); assert.equal(ids.length, 2);
    const uid = Number(ids[0]), gid = Number(ids[1]);
    command(['docker', ...serverArgs(p, uid, gid)]);
    validateResource(JSON.parse(command(['docker', 'inspect', p.name + '-server']))[0], p, 'server');
    let ready = false;
    for (let i = 0; i < 60; i++) {
      // pg_isready can accept connections to the entrypoint's temporary server.
      // Wait for the final PID-1 postmaster AND a real query to the exact target.
      const final = spawnSync('docker', ['exec', p.name + '-server', 'sh', '-c', 'read -r pid < "$PGDATA/postmaster.pid"; test "$pid" = 1'],
        { env: { PATH: process.env.PATH }, timeout: 3000, stdio: 'ignore' });
      if (!final.error && final.status === 0) {
        const r = spawnSync('docker', ['exec', p.name + '-server', 'psql', '-X', '-q', '-A', '-t', '--set=ON_ERROR_STOP=on',
          '-h', '/var/run/postgresql', '-U', 'postgres', '-d', 'neon_restore', '-c', "SELECT current_database()='neon_restore' AND current_setting('server_version_num')::int/10000=16"],
        { env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 3000 });
        if (!r.error && r.status === 0 && r.stdout.trim() === 't') { ready = true; break; }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert(ready);
    stage = 'RESTORE';
    command(['docker', 'exec', '-i', p.name + '-server', 'pg_restore', '-h', '/var/run/postgresql', '-U', 'postgres',
      '-d', 'neon_restore', '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction'],
    { input: restored.dump, timeout: 180000 });
    stage = 'INVENTORY_COMPARISON';
    const tables = compareInventory(parseInventory(localSql(p, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL TIME ZONE 'UTC'; SET LOCAL row_security=off;\n" + inventorySql + 'ROLLBACK;\n')), restored.bundle.tables);
    report = { startedAt, completedAt: new Date().toISOString(), sourceProject: c.project, archive: archiveName,
      archiveSha256: m.archive.sha256, restoredFromR2Download: true, remoteCopyVerified: true,
      authenticatedDecryptionPassed: true, restoredTablesAndChecksumsMatched: tables, postgresMajor: 16,
      sameHostOnly: true, secondHostRecovery: false, sourceDatabaseConnected: false, sourceUnchanged: true,
      serverNetwork: 'none', publicPorts: false, serverHostMounts: false, serverRunsAsRoot: false,
      dataStorage: 'bounded tmpfs; host swap required off', sourceCredentialsPassedToContainers: false,
      recoveryKeyPassedToContainers: false, recoveryKeyTransferred: false, originalOwnershipAndAclRestored: false,
      applicationLoginTested: false, timersEnabled: false, productionAccepted: false };
  } catch (error) {
    const code = ['RESTORE_ROLE_REFERENCE_MISSING', 'RESTORE_EXTENSION_UNAVAILABLE', 'RESTORE_RESOURCE_LIMIT', 'ISOLATED_COMMAND_FAILED',
      'RESTORE_TARGET_NOT_READY', 'RESTORE_SCHEMA_ALREADY_EXISTS', 'RESTORE_UNSUPPORTED_SETTING', 'RESTORE_PERMISSION_DENIED', 'RESTORE_SCHEMA_REFERENCE_MISSING'].includes(error.message)
      ? error.message : 'RECOVERY_CHECK_FAILED';
    atomicJson(path.join(p.directory, 'failure.json'), { failedAt: new Date().toISOString(), stage, code, sourceDatabaseConnected: false });
    throw new Error(`${stage}_${code}`);
  } finally {
    if (restored) restored.dump.fill(0);
    cleanup(p);
    if (watchdog) command(['systemctl', 'stop', p.name + '-cleanup.timer']);
  }
  report.disposableContainersRemoved = true; report.cleanupWatchdogStopped = true;
  report.retainedCiphertextDirectory = path.join(p.directory, 'download');
  atomicJson(path.join(p.directory, 'acceptance.json'), report);
  return report;
}
async function main() {
  assert(process.platform === 'linux' && process.getuid() === 0);
  const [mode, configFile, selected, confirm] = process.argv.slice(2);
  assert(['drill', 'cleanup'].includes(mode)); assert.equal(configFile, '/etc/school-erp-neon-backup/config.json');
  privateFile(configFile); const c = validateConfig(JSON.parse(fs.readFileSync(configFile)));
  if (mode === 'cleanup') {
    assert(path.isAbsolute(selected || '')); privateFile(selected);
    const p = validatePlan(JSON.parse(fs.readFileSync(selected)), c);
    assert.equal(selected, path.join(p.directory, 'plan.json')); cleanup(p);
    console.log(JSON.stringify({ exactDrillCleanupChecked: true })); return;
  }
  assert.equal(confirm, '--confirm-isolated'); assert.match(selected || '', filename);
  const available = fs.readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)/m);
  assert(available && Number(available[1]) >= 2 * 1024 * 1024);
  assert.equal(fs.readFileSync('/proc/swaps', 'utf8').trim().split(/\r?\n/).length, 1, 'HOST_SWAP_MUST_BE_OFF');
  console.log(JSON.stringify(await drill(c, selected)));
}
module.exports = { planFor, validatePlan, commonArgs, serverArgs, validateResource, parseInventory, compareInventory, failureCode };
if (require.main === module) main().catch((error) => {
  const code = /^[A-Z_]{1,100}$/.test(error.message) ? error.message : 'RECOVERY_CHECK_FAILED';
  console.error(`ISOLATED_NEON_RESTORE_NOT_ACCEPTED: ${code}; private diagnostics withheld`); process.exitCode = 1;
});
