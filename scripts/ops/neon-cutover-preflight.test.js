const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  neonTargets,
  compatibleConfiguration,
  inspectCutover,
} = require('./neon-cutover-preflight');

const source = {
  NEON_DATABASE_URL:
    'postgresql://owner:synthetic@ep-erp.example.neon.tech/school_erp?sslmode=require',
};
const runtime = {
  DATABASE_URL:
    'postgresql://runtime:synthetic@ep-erp-pooler.example.neon.tech/school_erp?sslmode=require',
  DATABASE_RLS_ENABLED: 'true',
};

test('live preflight matches the ERP endpoint and keeps runtime credentials restricted', () => {
  const targets = neonTargets(source, runtime);
  assert.equal(targets.owner.pathname, '/school_erp');
  assert.equal(targets.app.username, 'runtime');
});

test('live preflight refuses unrelated targets, pooling for owner, TLS weakening and role confusion', () => {
  for (const url of [
    source.NEON_DATABASE_URL.replace('ep-erp.', 'ep-other.'),
    source.NEON_DATABASE_URL.replace('ep-erp.', 'ep-erp-pooler.'),
    source.NEON_DATABASE_URL.replace('/school_erp?', '/unrelated?'),
    source.NEON_DATABASE_URL.replace('sslmode=require', 'sslmode=disable'),
    source.NEON_DATABASE_URL + '&host=somewhere.invalid',
    source.NEON_DATABASE_URL + '&schema=other',
    source.NEON_DATABASE_URL + '#fragment',
  ])
    assert.throws(() => neonTargets({ NEON_DATABASE_URL: url }, runtime));
  assert.throws(() =>
    neonTargets(source, { ...runtime, DATABASE_URL: source.NEON_DATABASE_URL }),
  );
  assert.throws(() =>
    neonTargets(source, { ...runtime, DATABASE_RLS_ENABLED: 'false' }),
  );
});

test('active and operator encryption/signing settings must agree before cutover', () => {
  const env = {
    JWT_ACCESS_SECRET: 'a'.repeat(64),
    JWT_REFRESH_SECRET: 'b'.repeat(64),
    PII_ENCRYPTION_KEY: 'k',
  };
  const crypto = {
    getPiiEncryptionKey: () => Buffer.from(process.env.PII_ENCRYPTION_KEY),
  };
  assert.doesNotThrow(() => compatibleConfiguration(env, env, crypto));
  for (const change of [
    { JWT_ACCESS_SECRET: 'c'.repeat(64) },
    { PII_ENCRYPTION_KEY: 'different' },
    { MFA_RECOVERY_CODE_PEPPER: 'c'.repeat(64) },
  ]) {
    assert.throws(() =>
      compatibleConfiguration(env, { ...env, ...change }, crypto),
    );
  }
});

function clients(overrides = {}) {
  let runtimeStarted = false;
  const commands = [];
  const tx = {
    user: { count: async (query) => (query ? 1 : 1068) },
    $executeRawUnsafe: async (sql) => {
      commands.push(sql);
      assert.equal(sql, 'SET TRANSACTION READ ONLY');
    },
    $queryRawUnsafe: async (sql) => {
      commands.push(sql);
      if (sql.includes('rolsuper'))
        return [
          {
            name: 'school_erp',
            role: 'runtime',
            superuser: false,
            bypass: false,
            ...overrides,
          },
        ];
      if (sql.includes('current_database() AS name'))
        return [{ name: 'school_erp', role: 'owner' }];
      if (sql.includes('_prisma_migrations'))
        return [{ count: overrides.failedMigrations || 0 }];
      if (sql.includes('pg_stat_activity')) return [{ count: 1 }];
      if (sql.includes('pg_tables')) return [{ count: 76 }];
      if (sql.includes('pg_class'))
        return [{ count: overrides.ownerCount || 0 }];
      if (sql.includes('public.schools'))
        return [{ count: overrides.unscoped || 0 }];
      throw new Error('Unexpected preflight SQL');
    },
  };
  for (const model of [
    'user',
    'student',
    'guardian',
    'staff',
    'identityProvider',
  ])
    tx[model] = { ...tx[model], findMany: async () => [] };
  return {
    owner: {
      $transaction: async (work) => {
        runtimeStarted = false;
        return work(tx);
      },
    },
    runtime: {
      $transaction: async (work) => {
        runtimeStarted = true;
        return work(tx);
      },
    },
    commands,
    isRuntime: () => runtimeStarted,
  };
}

test('live inspection uses only read-only transactions and reports open clients without terminating them', async () => {
  const db = clients();
  const result = await inspectCutover(
    db.owner,
    db.runtime,
    neonTargets(source, runtime),
    [],
  );
  assert.equal(result.runtimeConnectionsAtInspection, 1);
  assert.equal(result.users, 1068);
  assert.equal(db.isRuntime(), true);
  assert.ok(
    db.commands.every((sql) => /^(SELECT|SET TRANSACTION READ ONLY)/.test(sql)),
  );
});

for (const [name, override] of Object.entries({
  'superuser runtime': { superuser: true },
  'RLS bypass runtime': { bypass: true },
  'table ownership': { ownerCount: 1 },
  'unscoped tenant visibility': { unscoped: 1 },
  'unfinished migration': { failedMigrations: 1 },
})) {
  test(`live inspection refuses ${name}`, async () => {
    const db = clients(override);
    await assert.rejects(
      inspectCutover(db.owner, db.runtime, neonTargets(source, runtime), []),
    );
  });
}
