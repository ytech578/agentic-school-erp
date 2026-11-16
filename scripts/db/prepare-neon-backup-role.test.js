const { test } = require('node:test');
const assert = require('node:assert/strict');
const { target, provision } = require('./prepare-neon-backup-role');
function env() { return { NEON_DATABASE_URL: 'postgresql://school_erp_owner:fixture@ep-test.ap-southeast-1.aws.neon.tech/school_erp?sslmode=require',
  DATABASE_URL: 'postgresql://school_erp_runtime:fixture@ep-test-pooler.ap-southeast-1.aws.neon.tech/school_erp?sslmode=require' }; }
test('backup-role provisioning accepts only the dedicated ERP owner and matching restricted runtime endpoint', () => {
  assert.match(target(env()), /^postgresql:/);
  assert.equal(new URL(target(env())).searchParams.get('sslaccept'), 'strict');
  for (const changes of [{ NEON_DATABASE_URL: env().NEON_DATABASE_URL.replace('ep-test.', 'ep-other.') },
    { NEON_DATABASE_URL: env().NEON_DATABASE_URL.replace('school_erp_owner', 'other') },
    { NEON_DATABASE_URL: env().NEON_DATABASE_URL + '&host=attacker' },
    { NEON_DATABASE_URL: env().NEON_DATABASE_URL.replace('sslmode=require', 'sslmode=disable') },
    { DATABASE_URL: env().DATABASE_URL.replace('/school_erp?', '/other?') }]) assert.throws(() => target({ ...env(), ...changes }));
});
function txFixture({ wrong = false, exists = false, denied = false } = {}) {
  const commands = []; return { commands,
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('current_database()')) return [{ database: wrong ? 'other' : 'school_erp', actor: 'school_erp_owner', erp: true }];
      if (sql.includes('expected_school')) return [{ expected_school: true }];
      if (sql.includes('SELECT 1 AS exists')) return exists ? [{ exists: 1 }] : [];
      return [{ login: false, bypass: true, elevated: false, reader: true }];
    },
    $executeRawUnsafe: async (sql) => { commands.push(sql); if (denied) throw new Error('fixture permission denied'); },
  };
}
test('only an inactive non-admin all-tenant backup reader is created, without a password or runtime changes', async () => {
  const tx = txFixture(); const r = await provision(tx);
  assert.equal(r.created, true); assert.equal(r.passwordSet, false); assert.equal(r.loginEnabled, false);
  assert.match(tx.commands[0], /NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS/);
  assert.ok(tx.commands.includes('GRANT pg_read_all_data TO school_erp_backup'));
  assert.ok(!tx.commands.some((c) => c.includes('PASSWORD') || c.includes('neon_superuser') || c.includes('ALTER ROLE school_erp_runtime')));
});
test('wrong database, existing role and provider refusal cannot trigger fallback admin grants', async () => {
  for (const opts of [{ wrong: true }, { exists: true }, { denied: true }]) {
    const tx = txFixture(opts); await assert.rejects(provision(tx));
    assert.ok(!tx.commands.some((s) => s.includes('neon_superuser')));
    if (opts.wrong || opts.exists) assert.equal(tx.commands.length, 0);
  }
});
