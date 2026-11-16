'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planFor, validatePlan, commonArgs, serverArgs, validateResource, parseInventory, compareInventory, failureCode } = require('./isolated-neon-restore');
const c = { project: 'synthetic-school', stateDirectory: '/var/lib/synthetic-neon', postgresImage: 'sha256:' + 'a'.repeat(64), dependencyImage: 'sha256:' + 'b'.repeat(64) };
const p = planFor(c, 'a'.repeat(16));
const tables = ['schools', 'users', 'domain_audit_events', '_prisma_migrations'].map((name) => ({ schema: 'public', name, count: '2', checksum: 'c'.repeat(32) }));
function resource() { return { Id: 'c'.repeat(64), Name: '/' + p.name + '-server', Image: c.postgresImage,
  Config: { User: '70:70', Labels: { 'com.school-erp.restore.run': p.runId, 'com.school-erp.restore.purpose': 'server' } },
  HostConfig: { ReadonlyRootfs: true, NetworkMode: 'none', PortBindings: {}, Privileged: false, Tmpfs: {
    '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=512m,mode=0700,uid=70,gid=70',
    '/var/run/postgresql': 'rw,noexec,nosuid,size=16m,mode=0700,uid=70,gid=70',
    '/tmp': 'rw,noexec,nosuid,size=16m,mode=0700,uid=70,gid=70',
  } },
  Mounts: [{ Type: 'tmpfs', Destination: '/var/lib/postgresql/data' }] }; }
test('restore plan is restricted to an exact random namespace and private drill directory', () => {
  assert.deepEqual(validatePlan(p, c), p);
  for (const change of [{ name: 'school_erp_api' }, { directory: '/etc' }, { runId: '../bad' }, { postgresImage: c.dependencyImage }, { extra: true }])
    assert.throws(() => validatePlan({ ...p, ...change }, c));
});
test('restored PostgreSQL has no network, ports, source secrets, host mounts or persistent volume', () => {
  const args = serverArgs(p, 70, 70), text = args.join(' ');
  for (const v of ['--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory=1g', '--memory-swap=1g', '--user=70:70', 'listen_addresses=']) assert(args.includes(v));
  assert(!args.includes('--mount') && !args.includes('-p') && !args.includes('-v'));
  for (const v of ['PGPASSWORD', 'DATABASE_URL', 'recovery.key', 'application.env', 'docker.sock']) assert(!text.includes(v));
  for (const ids of [[0, 70], [70, 0], [1.5, 70], [70, 999999]]) assert.throws(() => serverArgs(p, ...ids));
});
test('helper only creates known resource purposes using immutable local images', () => {
  assert(commonArgs(p, 'fetch', c.dependencyImage).includes('--pull=never'));
  assert.throws(() => commonArgs(p, 'application', c.postgresImage));
  assert.throws(() => commonArgs(p, 'server', 'postgres:latest'));
});
test('cleanup refuses live/source names, wrong images, labels, networks and host storage', () => {
  assert.equal(validateResource(resource(), p, 'server'), 'c'.repeat(64));
  for (const change of [{ Name: '/school_erp_api' }, { Image: c.dependencyImage },
    { Config: { Labels: {} } }, { HostConfig: { ...resource().HostConfig, NetworkMode: 'bridge' } },
    { HostConfig: { ...resource().HostConfig, Privileged: true } },
    { HostConfig: { ...resource().HostConfig, PortBindings: { '5432/tcp': [] } } },
    { Mounts: [{ Type: 'bind', Destination: '/var/lib/postgresql/data' }] }])
    assert.throws(() => validateResource({ ...resource(), ...change }, p, 'server'));
});
test('inventory parser and comparison require every table count/checksum including extra schemas', () => {
  const expected = [...tables, { ...tables[0], schema: 'app_security' }];
  const parsed = parseInventory(expected.map((t) => JSON.stringify({ type: 'table', ...t })).join('\n'));
  assert.equal(compareInventory(parsed.reverse(), expected), 5);
  for (const actual of [tables, [...expected, expected[0]], expected.map((t) => ({ ...t, count: '3' })),
    expected.map((t) => ({ ...t, checksum: 'd'.repeat(32) }))]) assert.throws(() => compareInventory(actual, expected));
  assert.throws(() => parseInventory(JSON.stringify({ type: 'row', data: 'not a record output' })));
});
test('Docker tmpfs is checked through HostConfig even when absent from Mounts', () => {
  assert.equal(validateResource({ ...resource(), Mounts: [] }, p, 'server'), 'c'.repeat(64));
  for (const tmpfs of [{}, { '/var/lib/postgresql/data': 'rw,size=512m' }])
    assert.throws(() => validateResource({ ...resource(), Mounts: [], HostConfig: { ...resource().HostConfig, Tmpfs: tmpfs } }, p, 'server'));
});
test('recovery entry point never reads the database connection or starts live services', () => {
  const source = require('node:fs').readFileSync(__filename.replace('.test.js', '.js'), 'utf8');
  assert(!source.includes('readEnv(c.databaseEnvFile') && !source.includes('connectionEnv('));
  assert(!source.includes("'enable'") && !source.includes("'restart'"));
  assert(source.includes("'--no-owner', '--no-acl', '--exit-on-error', '--single-transaction'"));
  assert(source.includes('HOST_SWAP_MUST_BE_OFF') && source.includes("'--on-active=10m'"));
  assert(source.includes('test "$pid" = 1') && source.includes("current_database()='neon_restore'"));
});
test('failure diagnostics categorize errors without returning identifiers, SQL or record contents', () => {
  assert.equal(failureCode('ERROR: role "sensitive-user" does not exist'), 'RESTORE_ROLE_REFERENCE_MISSING');
  assert.equal(failureCode('ERROR: extension "private-extension" is not available'), 'RESTORE_EXTENSION_UNAVAILABLE');
  assert.equal(failureCode('no space left on device'), 'RESTORE_RESOURCE_LIMIT');
  assert.equal(failureCode('server closed the connection unexpectedly'), 'RESTORE_TARGET_NOT_READY');
  assert.equal(failureCode('database "synthetic" does not exist'), 'RESTORE_TARGET_NOT_READY');
  assert.equal(failureCode('schema "synthetic" already exists'), 'RESTORE_SCHEMA_ALREADY_EXISTS');
  assert.equal(failureCode('unrecognized configuration parameter "synthetic"'), 'RESTORE_UNSUPPORTED_SETTING');
  assert.equal(failureCode('duplicate key, row contains highly private synthetic data'), 'ISOLATED_COMMAND_FAILED');
});
