const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateNeonUrl, inspectNeon } = require('./check-neon');

test('requires an explicit Neon target and TLS without exposing credentials', () => {
  assert.throws(() => validateNeonUrl(), /Set NEON_DATABASE_URL/);
  assert.throws(() => validateNeonUrl('postgresql://role:password@localhost/db?sslmode=require'), /Neon hostname/);
  assert.throws(() => validateNeonUrl('postgresql://role:password@ep-test.neon.tech/db'), /require TLS/);
  assert.throws(() => validateNeonUrl('postgresql://role:password@ep-test.neon.tech/db?sslmode=require&sslaccept=accept_invalid_certs'), /certificate validation/);
  const target = validateNeonUrl('postgresql://role:password@ep-test-pooler.neon.tech/erp?sslmode=require');
  assert.equal(target.searchParams.get('connect_timeout'), '15');
  assert.equal(target.searchParams.get('connection_limit'), '1');
});

function database(tables, identity = {}) {
  const statements = [];
  const transaction = {
    $executeRawUnsafe: async (sql) => statements.push(sql),
    $queryRawUnsafe: async (sql) => {
      statements.push(sql);
      return sql.includes('current_database()')
        ? [{ database: 'erp', role: 'erp_runtime', superuser: false, bypass_rls: false, ...identity }]
        : tables;
    },
  };
  return { statements, $transaction: async (operation) => operation(transaction) };
}

test('inspects an empty target using a read-only transaction', async () => {
  const client = database([]);
  const result = await inspectNeon(client);
  assert.equal(client.statements[0], 'SET TRANSACTION READ ONLY');
  assert.equal(result.targetState, 'EMPTY_DATABASE');
  assert.equal(result.migrationOrDataChangesPerformed, false);
  assert.ok(client.statements.slice(1).every((sql) => sql.trimStart().startsWith('SELECT')));
});

test('identifies an unrelated database without modifying its tables', async () => {
  const result = await inspectNeon(database([{ name: 'another_app', rls_enabled: false }]));
  assert.equal(result.targetState, 'EXISTING_NON_ERP_SCHEMA');
  assert.match(result.nextStep, /dedicated ERP database/);
});

test('rejects ownership and BYPASSRLS as runtime-role readiness', async () => {
  const tables = ['schools', 'users', 'students', 'activity_logs'].map((name) => ({ name, rls_enabled: true, owner_privileges: true, rls_forced: false }));
  const owner = await inspectNeon(database(tables));
  assert.equal(owner.restrictedRuntimeRole, false);
  const bypass = await inspectNeon(database(tables.map((t) => ({ ...t, owner_privileges: false })), { bypass_rls: true }));
  assert.equal(bypass.restrictedRuntimeRole, false);
  const runtime = await inspectNeon(database(tables.map((t) => ({ ...t, owner_privileges: false }))));
  assert.equal(runtime.restrictedRuntimeRole, true);
});
