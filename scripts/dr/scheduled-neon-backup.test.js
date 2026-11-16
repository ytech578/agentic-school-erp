const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateConfig, connectionEnv, validateIdentity, validateTables, validateBundle, validatePlan,
  containerArgs, snapshotSql, inventorySql, health, loadArchive, cleanup } = require('./scheduled-neon-backup');
const { manifestFor, validateManifest, prepareObjects } = require('./neon-backup-transport');
const { encryptArchive } = require('./neon-backup');
const { sendAlert } = require('./identity-backup-transport');
function config() { return { project: 'synthetic-school', expectedHost: 'ep-synthetic.ap-southeast-1.aws.neon.tech',
  expectedDatabase: 'school_erp', expectedRole: 'school_erp_backup', postgresImage: 'sha256:' + 'a'.repeat(64),
  dependencyImage: 'sha256:' + 'b'.repeat(64), stateDirectory: '/var/lib/synthetic-neon', databaseEnvFile: '/private/database.env',
  keyFile: '/private/recovery.key', storageEnvFile: '/private/storage.env', alertEnvFile: '/private/alerts.env' }; }
function tables() { return ['schools', 'users', 'domain_audit_events', '_prisma_migrations'].map((name) => ({
  schema: 'public', name, count: '0', checksum: 'c'.repeat(32) })); }
function identity() { return { type: 'identity', database: 'school_erp', role: 'school_erp_backup', major: 16,
  readonly: true, bypass: true, superuser: false, createdb: false, createrole: false, replication: false,
  elevatedMembership: false, writes: false, owns: false, schemaCreate: false, databaseCreate: false, selectAll: true }; }
function bundle() { const dump = Buffer.from('PGDMP synthetic fixture, never a real database'); return {
  format: 'school-erp-neon-recovery', version: 1, project: config().project, database: 'school_erp',
  postgresMajor: 16, createdAt: new Date().toISOString(), tables: tables(), dump: {
    bytes: dump.length, sha256: crypto.createHash('sha256').update(dump).digest('hex'), base64: dump.toString('base64') } }; }
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-neon-service-'));
  const archives = path.join(directory, 'archives'); fs.mkdirSync(archives, { mode: 0o700 });
  const key = crypto.randomBytes(32), keyFile = path.join(directory, 'recovery.key'); fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 });
  const c = { ...config(), stateDirectory: directory, keyFile }; const b = bundle();
  const name = 'neon-1794490000000-1234abcd.enc', archive = path.join(archives, name);
  const encrypted = encryptArchive(Buffer.from(JSON.stringify(b)), key), m = manifestFor(b, encrypted, name);
  fs.writeFileSync(archive, encrypted, { mode: 0o600 }); fs.writeFileSync(archive + '.json', JSON.stringify(m), { mode: 0o600 });
  t.after(() => {
    for (const file of fs.readdirSync(archives)) fs.unlinkSync(path.join(archives, file)); fs.rmdirSync(archives);
    for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, file)); fs.rmdirSync(directory);
  });
  const objects = prepareObjects(encrypted, fs.readFileSync(archive + '.json'), c.project, name).map(({ key: objectKey, sha256, bytes }) => ({ key: objectKey, sha256, bytes, downloadedAndVerified: true }));
  const status = { project: c.project, lastRun: { ok: true }, lastSuccess: {
    archive, completedAt: new Date().toISOString(), backupCreatedAt: m.createdAt, remoteCopyVerified: true, objects } };
  return { c, b, name, m, archive, encrypted, key, status };
}
test('Neon service config pins independent credentials, database target and immutable images', () => {
  assert.deepEqual(validateConfig(config()), config());
  for (const changed of [{ expectedRole: 'school_erp_runtime' }, { expectedRole: 'school_erp_owner' },
    { expectedHost: 'ep-synthetic-pooler.ap-southeast-1.aws.neon.tech' }, { expectedHost: 'attacker.test' },
    { dependencyImage: 'latest' }, { postgresImage: 'postgres:16' }, { stateDirectory: '/' },
    { databaseEnvFile: '/a/../b' }, { keyFile: config().databaseEnvFile }, { ownerUrl: 'never' }]) {
    assert.throws(() => validateConfig({ ...config(), ...changed }));
  }
});
test('connection allowlist forces full TLS verification and read-only sessions, without inherited app secrets', () => {
  const c = config(), value = `postgresql://${c.expectedRole}:synthetic-password@${c.expectedHost}/${c.expectedDatabase}?sslmode=require`;
  const env = connectionEnv(value, c);
  assert.equal(env.PGSSLMODE, 'verify-full'); assert.match(env.PGOPTIONS, /default_transaction_read_only=on/);
  assert.equal(env.DATABASE_URL, undefined); assert.equal(env.BACKUP_ENCRYPTION_KEY, undefined);
  for (const value2 of [value.replace(c.expectedHost, 'ep-other.ap-southeast-1.aws.neon.tech'),
    value.replace('school_erp_backup', 'school_erp_owner'), value.replace('/school_erp?', '/other?'),
    value + '&options=-c%20row_security%3Don', value.replace('sslmode=require', 'sslmode=disable'),
    value.replace(c.expectedHost, c.expectedHost + ':6432')]) assert.throws(() => connectionEnv(value2, c));
});
test('source identity rejects RLS filtering, write privileges, ownership, elevated memberships and wrong server/database', () => {
  assert.doesNotThrow(() => validateIdentity(identity(), config()));
  for (const p of ['superuser', 'createdb', 'createrole', 'replication', 'elevatedMembership', 'writes', 'owns', 'schemaCreate', 'databaseCreate'])
    assert.throws(() => validateIdentity({ ...identity(), [p]: true }, config()));
  for (const change of [{ bypass: false }, { readonly: false }, { selectAll: false }, { database: 'other' }, { role: 'postgres' }, { major: 17 }])
    assert.throws(() => validateIdentity({ ...identity(), ...change }, config()));
});
test('all user-schema table inventory is checked with full tenant reads and matching snapshot', () => {
  assert.match(snapshotSql, /REPEATABLE READ READ ONLY/); assert.match(snapshotSql, /row_security=off/);
  assert.match(snapshotSql, /pg_export_snapshot/); assert.match(inventorySql, /\\gexec/);
  assert.match(inventorySql, /COLLATE "C"/); assert.ok(!inventorySql.includes("schemaname='public'"));
  assert.doesNotThrow(() => validateTables([...tables(), { ...tables()[0], schema: 'app_security' }]));
  for (const ts of [tables().slice(1), [...tables(), tables()[0]], tables().map((v) => ({ ...v, count: '-1' })),
    tables().map((v) => ({ ...v, checksum: 'bad' }))]) assert.throws(() => validateTables(ts));
});
test('plaintext recovery bundle authenticates inventory and custom dump, and excludes credentials', () => {
  assert.match(validateBundle(bundle(), config()).toString(), /^PGDMP/);
  for (const change of [{ project: 'other' }, { database: 'other' }, { tables: [] }, { databaseUrl: 'never' },
    { dump: { ...bundle().dump, sha256: '0'.repeat(64) } }, { dump: { ...bundle().dump, base64: 'bad' } }])
    assert.throws(() => validateBundle({ ...bundle(), ...change }, config()));
});
test('encrypted cloud archive verifies AES authentication, manifest, dump hash and inventory', (t) => {
  const f = fixture(t); assert.equal(loadArchive(f.archive, f.c).bundle.tables.length, 4);
  const bytes = Buffer.from(f.encrypted); bytes[bytes.length - 1] ^= 1; fs.writeFileSync(f.archive, bytes);
  assert.throws(() => loadArchive(f.archive, f.c));
});
test('wrong recovery key fails even with an otherwise valid manifest', (t) => {
  const f = fixture(t); fs.writeFileSync(f.c.keyFile, crypto.randomBytes(32).toString('hex'));
  assert.throws(() => loadArchive(f.archive, f.c));
});
test('public transfer manifest has strict non-secret fields and a distinct ERP prefix', (t) => {
  const f = fixture(t), bytes = fs.readFileSync(f.archive + '.json');
  const objects = prepareObjects(f.encrypted, bytes, f.c.project, f.name);
  assert.ok(objects.every((o) => o.key.startsWith('neon-backups/synthetic-school/')));
  for (const change of [{ recoveryKey: 'never' }, { tables: f.b.tables }, { project: 'other' }, { postgresMajor: 17 },
    { archive: { ...f.m.archive, file: '../bad.enc' } }]) assert.throws(() => validateManifest(Buffer.from(JSON.stringify({ ...f.m, ...change })), f.c.project, f.name));
  assert.throws(() => prepareObjects(Buffer.from('not encrypted'), bytes, f.c.project, f.name));
});
test('monitor rejects missing/stale/failed backups and mismatched remote GET receipts', (t) => {
  const f = fixture(t); assert.equal(health(f.status, f.c).healthy, true);
  assert.equal(health({}, f.c).healthy, false);
  assert.equal(health(f.status, f.c, Date.now() + 27 * 3600000).healthy, false);
  assert.equal(health({ ...f.status, lastRun: { ok: false } }, f.c).healthy, false);
  for (const change of [{ remoteCopyVerified: false }, { archive: '/somewhere/other.enc' },
    { objects: f.status.lastSuccess.objects.map((o) => ({ ...o, downloadedAndVerified: false })) },
    { objects: f.status.lastSuccess.objects.map((o) => ({ ...o, sha256: '0'.repeat(64) })) }])
    assert.equal(health({ ...f.status, lastSuccess: { ...f.status.lastSuccess, ...change } }, f.c).healthy, false);
});
test('client cleanup plans cannot address any existing application/identity container', () => {
  const runId = 'a'.repeat(16), plan = { project: config().project, runId, invocationId: 'b'.repeat(32), names: ['snapshot', 'dump', 'verify'].map((s) => `erp-neon-${runId}-${s}`) };
  assert.doesNotThrow(() => validatePlan(plan, config()));
  for (const change of [{ project: 'other' }, { runId: '../bad' }, { invocationId: 'unbounded' }, { names: ['school_erp_api', 'server', 'worker'] }])
    assert.throws(() => validatePlan({ ...plan, ...change }, config()));
});
test('PostgreSQL clients have no host storage, ports, API access or credential arguments', () => {
  const args = containerArgs(config(), 'erp-neon-test', 'a'.repeat(16), { PGPASSWORD: 'synthetic-secret' }, 'pg_dump', ['--format=custom']);
  assert.ok(args.includes('--read-only') && args.includes('--cap-drop=ALL') && args.includes('--log-driver=none'));
  assert.ok(!args.join(' ').includes('synthetic-secret')); assert.ok(!args.some((a) => a.includes('docker.sock')));
  assert.ok(!args.includes('--mount') && !args.includes('-p') && !args.includes('--enable-row-security'));
  assert.ok(args.includes('--tmpfs'));
  const verify = containerArgs(config(), 'erp-neon-test', 'a'.repeat(16), {}, 'pg_restore', ['--list']);
  assert.ok(verify.includes('--network=none'));
});
test('a delayed service cleanup cannot consume the next backup invocation plan', (t) => {
  const f = fixture(t), runId = 'a'.repeat(16);
  const plan = { project: f.c.project, runId, invocationId: 'b'.repeat(32), names: ['snapshot', 'dump', 'verify'].map((s) => `erp-neon-${runId}-${s}`) };
  const file = path.join(f.c.stateDirectory, 'client-plan.json');
  const bytes = JSON.stringify(plan, null, 2) + '\n'; fs.writeFileSync(file, bytes, { mode: 0o600 });
  cleanup(f.c, 'c'.repeat(32)); assert.equal(fs.readFileSync(file, 'utf8'), bytes);
  assert.throws(() => cleanup(f.c, '')); assert.equal(fs.readFileSync(file, 'utf8'), bytes);
});
test('shared SMTP alert supports clear database category while preserving identity default', async () => {
  let message; const factory = () => ({ sendMail: async (m) => { message = m; return { accepted: ['operator@example.test'] }; }, close() {} });
  const env = { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465', SMTP_FROM: 'sender@example.test', BACKUP_ALERT_EMAIL: 'operator@example.test' };
  await sendAlert({ project: config().project, codes: ['NEON_TEST_ALERT_ONLY'] }, env, factory, 'database'); assert.match(message.subject, /ERP database backup/);
  await sendAlert({ project: config().project, codes: ['TEST_ALERT_ONLY'] }, env, factory); assert.match(message.subject, /ERP identity backup/);
  await assert.rejects(sendAlert({ project: config().project, codes: ['TEST_ALERT_ONLY'] }, env, factory, 'arbitrary\nsubject'));
});
test('systemd units separate Neon state from identity, lock overlaps, clean clients and never stop ERP', () => {
  const dir = path.resolve(__dirname, '../../infrastructure/backups/neon');
  const service = fs.readFileSync(path.join(dir, 'school-erp-neon-backup.service'), 'utf8');
  const timer = fs.readFileSync(path.join(dir, 'school-erp-neon-backup.timer'), 'utf8');
  assert.match(service, /flock --nonblock/); assert.match(service, /ExecStopPost=.* cleanup /);
  assert.match(service, /ProtectSystem=strict/); assert.match(service, /ReadWritePaths=\/var\/lib\/school-erp-neon-backup/);
  assert.match(timer, /02:00:00 Asia\/Kolkata/); assert.match(timer, /Persistent=false/);
  assert.ok(!service.includes('docker stop') && !service.includes('application.env'));
  const installer = fs.readFileSync(path.join(__dirname, 'install-neon-backup-service.js'), 'utf8');
  assert.ok(!installer.includes("['enable'") && !installer.includes("['start'"));
  const ignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf8');
  assert.ok(ignore.includes('!/infrastructure/backups/'));
});
