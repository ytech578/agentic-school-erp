'use strict';
// Separate Linux host job: read-only exported snapshot, no API/container mutation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { atomicJson, readEnv } = require('./scheduled-identity-backup');
const { encryptArchive, decryptArchive } = require('./neon-backup');
const { projectName } = require('./identity-backup-transport');
const { maximum, filename, validateManifest, manifestFor } = require('./neon-backup-transport');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const maxDump = 64 * 1024 * 1024;
const s3Keys = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET_NAME', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASSWORD', 'BACKUP_ALERT_EMAIL'];
function privateFile(p) {
  const s = fs.lstatSync(p);
  assert.ok(s.isFile() && !s.isSymbolicLink());
  if (process.platform === 'linux') assert.ok(s.uid === process.getuid() && !(s.mode & 0o077));
}
function validateConfig(c) {
  assert.deepEqual(Object.keys(c).sort(), ['project', 'expectedHost', 'expectedDatabase', 'expectedRole',
    'postgresImage', 'dependencyImage', 'stateDirectory', 'databaseEnvFile', 'keyFile', 'storageEnvFile', 'alertEnvFile'].sort());
  projectName(c.project);
  assert.match(c.expectedHost, /^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/);
  assert.ok(!c.expectedHost.includes('-pooler.'));
  for (const p of ['expectedDatabase', 'expectedRole']) assert.match(c[p], /^[a-z_][a-z0-9_]{0,62}$/);
  assert.ok(!/(?:runtime|owner|postgres)$/.test(c.expectedRole));
  for (const p of ['postgresImage', 'dependencyImage']) assert.match(c[p], /^sha256:[a-f0-9]{64}$/);
  for (const p of ['stateDirectory', 'databaseEnvFile', 'keyFile', 'storageEnvFile', 'alertEnvFile']) {
    assert.ok(typeof c[p] === 'string' && path.posix.isAbsolute(c[p]) && c[p] !== '/' &&
      !/[\r\n,\x00]/.test(c[p]) && !c[p].split('/').includes('..'));
  }
  assert.equal(new Set([c.databaseEnvFile, c.keyFile, c.storageEnvFile, c.alertEnvFile]).size, 4);
  return c;
}
function connectionEnv(value, c) {
  const u = new URL(value);
  assert.ok(['postgres:', 'postgresql:'].includes(u.protocol));
  assert.equal(u.hostname, c.expectedHost); assert.equal(u.port || '5432', '5432');
  assert.equal(decodeURIComponent(u.username), c.expectedRole);
  assert.equal(decodeURIComponent(u.pathname.slice(1)), c.expectedDatabase);
  assert.ok(!u.hash && u.password);
  for (const name of u.searchParams.keys()) assert.ok(['sslmode', 'connect_timeout', 'channel_binding'].includes(name));
  assert.ok(['require', 'verify-full'].includes(u.searchParams.get('sslmode')));
  const env = { PGHOST: u.hostname, PGPORT: '5432', PGUSER: c.expectedRole, PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: c.expectedDatabase, PGSSLMODE: 'verify-full', PGSSLROOTCERT: '/etc/ssl/certs/ca-certificates.crt',
    PGCONNECT_TIMEOUT: '20', PGAPPNAME: 'school-erp-dedicated-backup',
    PGOPTIONS: '-c default_transaction_read_only=on -c timezone=UTC -c statement_timeout=120000 -c idle_in_transaction_session_timeout=180000' };
  assert.ok(Object.values(env).every((v) => !/[\x00\r\n]/.test(v)));
  return env;
}
function validateIdentity(d, c) {
  assert.equal(d.database, c.expectedDatabase); assert.equal(d.role, c.expectedRole);
  assert.equal(d.major, 16); assert.equal(d.readonly, true); assert.equal(d.bypass, true);
  for (const p of ['superuser', 'createdb', 'createrole', 'replication', 'elevatedMembership', 'writes', 'owns', 'schemaCreate', 'databaseCreate']) assert.equal(d[p], false);
  assert.equal(d.selectAll, true); return d;
}
const inventorySql = String.raw`SELECT format('SELECT json_build_object(''type'',''table'',''schema'',%L,''name'',%L,''count'',count(*)::text,''checksum'',md5(COALESCE(string_agg(md5(row_to_json(t)::text),'''' ORDER BY md5(row_to_json(t)::text) COLLATE "C"),''''))) FROM %I.%I t;', schemaname, tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') AND schemaname !~ '^pg_toast' ORDER BY schemaname,tablename
\gexec
`;
const snapshotSql = String.raw`\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL row_security=off;
SELECT json_build_object('type','identity','database',current_database(),'role',current_user,
'major',current_setting('server_version_num')::int/10000,'readonly',current_setting('transaction_read_only')='on',
'bypass',r.rolbypassrls,'superuser',r.rolsuper,'createdb',r.rolcreatedb,'createrole',r.rolcreaterole,'replication',r.rolreplication,
'elevatedMembership',EXISTS(SELECT 1 FROM pg_roles e WHERE (e.rolsuper OR e.rolcreatedb OR e.rolcreaterole OR e.rolreplication) AND pg_has_role(current_user,e.oid,'MEMBER')),
'selectAll',NOT EXISTS(SELECT 1 FROM pg_tables t WHERE t.schemaname NOT IN ('pg_catalog','information_schema') AND t.schemaname !~ '^pg_toast' AND NOT has_table_privilege(current_user,format('%I.%I',t.schemaname,t.tablename),'SELECT')),
'writes',EXISTS(SELECT 1 FROM pg_tables t WHERE t.schemaname NOT IN ('pg_catalog','information_schema') AND t.schemaname !~ '^pg_toast' AND has_table_privilege(current_user,format('%I.%I',t.schemaname,t.tablename),'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')),
'owns',EXISTS(SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast' AND pg_has_role(current_user,t.relowner,'MEMBER')),
'schemaCreate',has_schema_privilege(current_user,'public','CREATE'),'databaseCreate',has_database_privilege(current_user,current_database(),'CREATE')) FROM pg_roles r WHERE r.rolname=current_user;
SELECT json_build_object('type','snapshot','snapshot',pg_export_snapshot());
` + inventorySql + `SELECT '{"type":"ready"}';\n`;
function validateTables(tables) {
  assert.ok(Array.isArray(tables) && tables.length >= 4 && tables.length <= 10000);
  const names = new Set();
  for (const t of tables) {
    assert.deepEqual(Object.keys(t).sort(), ['schema', 'name', 'count', 'checksum'].sort());
    assert.ok(typeof t.schema === 'string' && t.schema && !['pg_catalog', 'information_schema'].includes(t.schema) && !t.schema.startsWith('pg_toast'));
    const id = JSON.stringify([t.schema, t.name]);
    assert.ok(typeof t.name === 'string' && t.name && !names.has(id)); names.add(id);
    assert.match(t.count, /^\d+$/); assert.match(t.checksum, /^[a-f0-9]{32}$/);
  }
  for (const n of ['schools', 'users', 'domain_audit_events', '_prisma_migrations']) assert.ok(names.has(JSON.stringify(['public', n])));
  return tables;
}
function command(p, args, options = {}) {
  const r = spawnSync(p, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, ...options });
  if (r.error || r.status !== 0) throw new Error('PRIVATE_COMMAND_FAILED');
  return r.stdout;
}
function containerArgs(c, name, runId, env, program, args) {
  return ['run', '--rm', '-i', '--pull=never', '--name', name, '--label', `com.school-erp.backup.run=${runId}`,
    '--label', 'com.school-erp.backup.purpose=neon-export', '--read-only', '--user=65532:65532',
    '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory=256m', '--memory-swap=256m', '--cpus=0.5',
    '--pids-limit=64', '--log-driver=none',
    // Override the image's VOLUME: clients must never create anonymous disks.
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=1m,mode=0700,uid=65532,gid=65532',
    ...((program === 'pg_restore' || args.includes('--version')) ? ['--network=none'] : []),
    ...Object.keys(env).flatMap((n) => ['-e', n]),
    '--entrypoint', program, c.postgresImage, ...args];
}
function validatePlan(plan, c) {
  assert.equal(plan.project, c.project); assert.match(plan.runId, /^[a-f0-9]{16}$/);
  assert.match(plan.invocationId, /^[a-f0-9]{32}$/);
  assert.deepEqual(plan.names, ['snapshot', 'dump', 'verify'].map((s) => `erp-neon-${plan.runId}-${s}`)); return plan;
}
function cleanup(c, expectedInvocationId) {
  const file = path.join(c.stateDirectory, 'client-plan.json'); if (!fs.existsSync(file)) return;
  privateFile(file); const plan = validatePlan(JSON.parse(fs.readFileSync(file)), c);
  assert.match(expectedInvocationId || '', /^[a-f0-9]{32}$/);
  // ExecStopPost must not consume another invocation's plan after flock exits.
  if (plan.invocationId !== expectedInvocationId) return;
  for (const name of plan.names) {
    const present = command('docker', ['ps', '-aq', '--filter', `name=^/${name}$`]).trim(); if (!present) continue;
    const d = JSON.parse(command('docker', ['inspect', name]))[0];
    assert.equal(d.Name, '/' + name); assert.equal(d.Config.Labels?.['com.school-erp.backup.run'], plan.runId);
    assert.equal(d.Config.Labels?.['com.school-erp.backup.purpose'], 'neon-export'); assert.equal(d.Image, c.postgresImage);
    assert.ok(d.Mounts.every((m) => m.Type === 'tmpfs' && m.Destination === '/var/lib/postgresql/data') &&
      !Object.keys(d.HostConfig.PortBindings || {}).length);
    command('docker', ['rm', '--force', d.Id]); // Only exact invocation-owned, volume-free clients.
  }
  assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify(plan, null, 2) + '\n'); fs.unlinkSync(file);
}
function capture(args, env, input, limit = maxDump, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { env: { PATH: process.env.PATH, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let size = 0; let failed = false;
    const timer = setTimeout(() => { failed = true; child.kill('SIGKILL'); }, timeout);
    child.stdout.on('data', (b) => { size += b.length; if (size > limit) { failed = true; child.kill('SIGKILL'); } else chunks.push(b); });
    child.stderr.resume(); child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(new Error('PRIVATE_CLIENT_FAILED')); });
    child.on('close', (code) => { clearTimeout(timer); if (failed || code !== 0) reject(new Error('PRIVATE_CLIENT_FAILED')); else resolve(Buffer.concat(chunks)); });
    child.stdin.end(input);
  });
}
function openSnapshot(c, plan, env) {
  const child = spawn('docker', containerArgs(c, plan.names[0], plan.runId, env, 'psql', ['-X', '-q', '-A', '-t', '--no-password']),
    { env: { PATH: process.env.PATH, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let text = '', total = 0, identity, snapshot, ready = false, failed = false;
  const tables = []; let settle;
  const done = new Promise((resolve) => { child.on('error', () => { failed = true; resolve(false); }); child.on('close', (code) => { if (code !== 0) failed = true; resolve(!failed); }); });
  const pending = new Promise((resolve, reject) => {
    settle = reject;
    child.stdout.on('data', (data) => {
      try {
        total += data.length; assert.ok(total <= 2 * 1024 * 1024); text += data.toString();
        let i;
        while ((i = text.indexOf('\n')) >= 0) {
          const line = text.slice(0, i).trim(); text = text.slice(i + 1); if (!line) continue;
          const item = JSON.parse(line);
          if (item.type === 'identity') { assert.ok(!identity); identity = validateIdentity(item, c); }
          else if (item.type === 'snapshot') { assert.ok(!snapshot); assert.match(item.snapshot, /^[A-Fa-f0-9-]+$/); snapshot = item.snapshot; }
          else if (item.type === 'table') { const { type: _type, ...t } = item; tables.push(t); }
          else if (item.type === 'ready') { assert.ok(identity && snapshot && !ready); validateTables(tables); ready = true; resolve({ snapshot, tables }); }
          else throw new Error('INVALID_SNAPSHOT_PROTOCOL');
        }
      } catch { failed = true; reject(new Error('BACKUP_ROLE_OR_SNAPSHOT_INVALID')); child.kill('SIGKILL'); }
    });
    child.on('error', () => reject(new Error('PRIVATE_SNAPSHOT_FAILED')));
    child.on('close', () => { if (!ready) reject(new Error('PRIVATE_SNAPSHOT_FAILED')); });
  });
  child.stderr.resume(); child.stdin.on('error', () => {}); child.stdin.write(snapshotSql);
  const timer = setTimeout(() => { failed = true; settle(new Error('SNAPSHOT_TIMEOUT')); child.kill('SIGKILL'); }, 240000);
  return { pending, finish: async () => {
    child.stdin.end('ROLLBACK;\n');
    const timeout = setTimeout(() => { failed = true; child.kill('SIGKILL'); }, 15000);
    try { assert.equal(await done, true); } finally { clearTimeout(timer); clearTimeout(timeout); }
  }, abort: () => { clearTimeout(timer); child.kill('SIGKILL'); } };
}
function validateBundle(bundle, c) {
  assert.deepEqual(Object.keys(bundle).sort(), ['format', 'version', 'project', 'database', 'createdAt', 'postgresMajor', 'tables', 'dump'].sort());
  assert.equal(bundle.format, 'school-erp-neon-recovery'); assert.equal(bundle.version, 1); assert.equal(bundle.project, c.project);
  assert.equal(bundle.database, c.expectedDatabase); assert.equal(bundle.postgresMajor, 16); assert.ok(Number.isFinite(Date.parse(bundle.createdAt)));
  validateTables(bundle.tables); assert.deepEqual(Object.keys(bundle.dump).sort(), ['bytes', 'sha256', 'base64'].sort());
  assert.ok(Number.isSafeInteger(bundle.dump.bytes) && bundle.dump.bytes > 5 && bundle.dump.bytes <= maxDump);
  assert.ok(typeof bundle.dump.base64 === 'string' && bundle.dump.base64.length <= Math.ceil(maxDump / 3) * 4);
  const dump = Buffer.from(bundle.dump.base64, 'base64'); assert.equal(dump.toString('base64'), bundle.dump.base64);
  assert.equal(dump.length, bundle.dump.bytes); assert.equal(sha(dump), bundle.dump.sha256); assert.equal(dump.subarray(0, 5).toString(), 'PGDMP');
  return dump;
}
function loadArchive(file, c) {
  privateFile(file); privateFile(file + '.json'); privateFile(c.keyFile);
  assert.match(path.basename(file), filename); assert.ok(fs.statSync(file).size <= maximum);
  assert.ok(fs.statSync(file + '.json').size <= 65536);
  const encrypted = fs.readFileSync(file), bytes = fs.readFileSync(file + '.json');
  const m = validateManifest(bytes, c.project, path.basename(file)); assert.equal(encrypted.length, m.archive.bytes); assert.equal(sha(encrypted), m.archive.sha256);
  const text = fs.readFileSync(c.keyFile, 'utf8').trim(); assert.match(text, /^[a-f0-9]{64}$/i); const key = Buffer.from(text, 'hex');
  try {
    const plain = decryptArchive(encrypted, key); assert.ok(plain.length <= maximum - 35);
    const b = JSON.parse(plain); const dump = validateBundle(b, c);
    assert.deepEqual(manifestFor(b, encrypted, path.basename(file)), m); return { bundle: b, dump, manifest: m };
  } finally { key.fill(0); }
}
function transport(c, mode, archive, input) {
  const env = readEnv(mode === 'alert' ? c.alertEnvFile : c.storageEnvFile, mode === 'alert' ? smtpKeys : s3Keys);
  const dir = fs.mkdtempSync(path.join(c.stateDirectory, 'transfer-')); const owned = [];
  try {
    fs.chownSync(dir, 65532, 65532); fs.chmodSync(dir, 0o700);
    if (archive) for (const suffix of ['', '.json']) {
      const source = archive + suffix; privateFile(source); const target = path.join(dir, path.basename(source));
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL); owned.push(target); fs.chownSync(target, 65532, 65532); fs.chmodSync(target, 0o400);
    }
    const args = ['run', '--rm', '-i', '--pull=never', '--read-only', '--user=65532:65532', '--cap-drop=ALL',
      '--security-opt=no-new-privileges', '--memory=512m', '--memory-swap=512m', '--cpus=0.5', '--pids-limit=64', '--log-driver=none',
      ...['neon-backup-transport.js', 'identity-backup-transport.js'].flatMap((n) => ['--mount', `type=bind,src=${path.join(__dirname, n)},dst=/app/${n},readonly`]),
      '--mount', `type=bind,src=${dir},dst=/transfer,readonly`, ...Object.keys(env).flatMap((n) => ['-e', n]),
      '--entrypoint=node', c.dependencyImage, '/app/neon-backup-transport.js', mode, c.project, ...(archive ? [path.basename(archive)] : [])];
    return JSON.parse(command('docker', args, { env: { PATH: process.env.PATH, ...env }, input, timeout: mode === 'alert' ? 60000 : 240000 }));
  } finally { for (const f of owned) fs.unlinkSync(f); fs.rmdirSync(dir); }
}
function health(status, c, now = Date.now()) {
  const codes = [], s = status.lastSuccess;
  if (status.project !== c.project || status.lastRun?.ok !== true) codes.push('NEON_LATEST_RUN_NOT_SUCCESSFUL');
  const created = Date.parse(s?.backupCreatedAt), completed = Date.parse(s?.completedAt);
  if (![created, completed].every(Number.isFinite) || created > completed || completed > now || now - created > 26 * 3600000 || now - completed > 26 * 3600000) codes.push('NEON_BACKUP_MISSING_OR_STALE');
  try {
    assert.equal(path.dirname(s.archive), path.join(c.stateDirectory, 'archives')); privateFile(s.archive); privateFile(s.archive + '.json');
    const bytes = fs.readFileSync(s.archive + '.json'); const m = validateManifest(bytes, c.project, path.basename(s.archive), now);
    assert.equal(fs.statSync(s.archive).size, m.archive.bytes); assert.equal(sha(fs.readFileSync(s.archive)), m.archive.sha256);
    assert.equal(s.backupCreatedAt, m.createdAt); assert.equal(s.remoteCopyVerified, true); assert.equal(s.objects.length, 2);
    for (const o of [{ key: `neon-backups/${c.project}/${m.archive.file}`, bytes: m.archive.bytes, sha256: m.archive.sha256 },
      { key: `neon-backups/${c.project}/${m.archive.file}.json`, bytes: bytes.length, sha256: sha(bytes) }]) {
      assert.ok(s.objects.some((r) => r.key === o.key && r.bytes === o.bytes && r.sha256 === o.sha256 && r.downloadedAndVerified === true));
    }
  } catch { codes.push('NEON_ARCHIVE_OR_REMOTE_RECEIPT_INVALID'); }
  return { healthy: !codes.length, codes };
}
function readStatus(c) { const p = path.join(c.stateDirectory, 'status.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : {}; }
async function monitor(c, test = false) {
  let status; try { status = readStatus(c); } catch { status = {}; }
  const result = test ? { healthy: false, codes: ['NEON_TEST_ALERT_ONLY'] } : health(status, c);
  if (result.healthy) return result;
  const signature = sha(Buffer.from(result.codes.join(','))), last = status.lastAlert;
  const age = Date.now() - Date.parse(last?.attemptedAt);
  if (!test && last?.signature === signature && last?.acceptedBySmtp === true && age >= 0 && age < 6 * 3600000) return result;
  let accepted = false;
  try { accepted = transport(c, 'alert', null, JSON.stringify({ project: c.project, codes: result.codes })).acceptedBySmtp === true; } catch { /* No private SMTP diagnostics. */ }
  if (!test) atomicJson(path.join(c.stateDirectory, 'status.json'), { ...status, lastAlert: { signature, attemptedAt: new Date().toISOString(), acceptedBySmtp: accepted, inboxDeliveryVerified: false } });
  return { ...result, alertAcceptedBySmtp: accepted, inboxDeliveryVerified: false };
}
async function backup(c, probeOnly = false) {
  const old = readStatus(c), startedAt = new Date().toISOString();
  const file = path.join(c.stateDirectory, 'status.json'); const planFile = path.join(c.stateDirectory, 'client-plan.json');
  assert.equal(fs.existsSync(planFile), false, 'STALE_CLIENT_PLAN_REQUIRES_CLEANUP');
  if (!probeOnly) atomicJson(file, { ...old, project: c.project, lastRun: { startedAt, ok: false, code: 'RUNNING' } });
  let session, stage = 'PREFLIGHT';
  const invocationId = process.env.INVOCATION_ID || crypto.randomBytes(16).toString('hex');
  try {
    for (const p of [c.databaseEnvFile, c.keyFile, c.storageEnvFile, c.alertEnvFile]) privateFile(p);
    const env = connectionEnv(readEnv(c.databaseEnvFile, ['NEON_BACKUP_DATABASE_URL']).NEON_BACKUP_DATABASE_URL, c);
    const keyText = fs.readFileSync(c.keyFile, 'utf8').trim(); assert.match(keyText, /^[a-f0-9]{64}$/i);
    command('docker', ['image', 'inspect', c.postgresImage]); command('docker', ['image', 'inspect', c.dependencyImage]);
    const runId = crypto.randomBytes(8).toString('hex'); const plan = { project: c.project, runId, invocationId, names: ['snapshot', 'dump', 'verify'].map((s) => `erp-neon-${runId}-${s}`) };
    atomicJson(planFile, plan);
    const clientVersion = await capture(containerArgs(c, plan.names[2], runId, {}, 'pg_dump', ['--version']), {}, undefined, 4096, 30000);
    assert.match(clientVersion.toString(), /^pg_dump \(PostgreSQL\) 16\./);
    stage = 'SNAPSHOT'; session = openSnapshot(c, plan, env); const { snapshot, tables } = await session.pending;
    if (probeOnly) { await session.finish(); session = null; return { sourceReadOnlyPreflightPassed: true, tables: tables.length, sourceUnchanged: true }; }
    stage = 'DUMP';
    const dump = await capture(containerArgs(c, plan.names[1], runId, env, 'pg_dump', ['--format=custom', `--snapshot=${snapshot}`, '--lock-wait-timeout=10000']), env);
    await session.finish(); session = null; assert.equal(dump.subarray(0, 5).toString(), 'PGDMP');
    stage = 'VERIFY_DUMP';
    await capture(containerArgs(c, plan.names[2], runId, {}, 'pg_restore', ['--list']), {}, dump, 4 * 1024 * 1024, 30000);
    const bundle = { format: 'school-erp-neon-recovery', version: 1, project: c.project, database: c.expectedDatabase,
      createdAt: startedAt, postgresMajor: 16, tables, dump: { bytes: dump.length, sha256: sha(dump), base64: dump.toString('base64') } };
    validateBundle(bundle, c); const plain = Buffer.from(JSON.stringify(bundle)); assert.ok(plain.length <= maximum - 35);
    const key = Buffer.from(keyText, 'hex'); let encrypted;
    try { encrypted = encryptArchive(plain, key); assert.ok(decryptArchive(encrypted, key).equals(plain)); } finally { key.fill(0); }
    stage = 'WRITE_ARCHIVE';
    const name = `neon-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.enc`;
    const archive = path.join(c.stateDirectory, 'archives', name); const m = manifestFor(bundle, encrypted, name);
    fs.writeFileSync(archive, encrypted, { flag: 'wx', mode: 0o600 }); atomicJson(archive + '.json', m); loadArchive(archive, c);
    cleanup(c, invocationId); stage = 'R2_UPLOAD'; const receipt = transport(c, 'upload', archive); assert.equal(receipt.remoteCopyVerified, true);
    const completedAt = new Date().toISOString(); const next = { ...old, project: c.project, lastRun: { startedAt, completedAt, ok: true },
      lastSuccess: { completedAt, backupCreatedAt: m.createdAt, archive, remoteCopyVerified: true, objects: receipt.objects } };
    assert.equal(health(next, c).healthy, true); atomicJson(file, next);
    return { ok: true, completedAt, tables: tables.length, remoteCopyVerified: true, sourceUnchanged: true, automaticDeletion: false };
  } catch {
    if (probeOnly) throw new Error('READ_ONLY_PREFLIGHT_NOT_ACCEPTED');
    atomicJson(file, { ...old, project: c.project, lastRun: { startedAt, completedAt: new Date().toISOString(), ok: false, code: `${stage}_FAILED` } });
    await monitor(c); return { ok: false, code: `${stage}_FAILED` };
  } finally { if (session) session.abort(); cleanup(c, invocationId); }
}
async function main() {
  assert.ok(process.platform === 'linux' && process.getuid() === 0);
  const [mode, config, archive] = process.argv.slice(2); assert.ok(['preflight', 'run', 'monitor', 'test-alert', 'verify', 'cleanup'].includes(mode));
  assert.ok(path.isAbsolute(config || '')); privateFile(config); const c = validateConfig(JSON.parse(fs.readFileSync(config)));
  const s = fs.lstatSync(c.stateDirectory); assert.ok(s.isDirectory() && !s.isSymbolicLink() && s.uid === 0 && !(s.mode & 0o077));
  let result;
  if (mode === 'cleanup') { cleanup(c, process.env.INVOCATION_ID || archive); result = { invocationBoundCleanupChecked: true }; }
  else if (mode === 'verify') { assert.equal(path.dirname(archive || ''), path.join(c.stateDirectory, 'archives')); const r = loadArchive(archive, c); result = { authenticated: true, tables: r.bundle.tables.length, restoreExecuted: false }; }
  else if (['monitor', 'test-alert'].includes(mode)) result = await monitor(c, mode === 'test-alert');
  else result = await backup(c, mode === 'preflight');
  console.log(JSON.stringify(result)); if (result.ok === false || (mode === 'monitor' && !result.healthy) || (mode === 'test-alert' && !result.alertAcceptedBySmtp)) process.exitCode = 1;
}
module.exports = { maxDump, validateConfig, connectionEnv, validateIdentity, validateTables, validateBundle, validatePlan, containerArgs, snapshotSql, inventorySql, health, loadArchive, capture, cleanup };
if (require.main === module) main().catch(() => { console.error('NEON_BACKUP_NOT_ACCEPTED; private diagnostics withheld'); process.exitCode = 1; });
