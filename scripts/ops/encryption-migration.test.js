const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  FIELDS,
  restoredTarget,
  keyFromValue,
  encryptField,
  decryptField,
  rotationSecrets,
  migrateFields,
} = require('./encryption-migration');
const {
  withEncryptionEnvironment,
  testTotp,
  restoreReport,
  saveJournal,
} = require('./migrate-encryption-local');

const database = 'erp_neon_drill_1794055238817_ca321ef01ec4';
const report = {
  restoredDatabase: database,
  tablesVerified: 76,
  verifiedAt: '2020-01-01T00:00:00Z',
  sourceUntouched: true,
  restoredDatabaseRetainedForInspection: true,
};

test('migration target is always the explicitly verified local restore', () => {
  const target = restoredTarget(
    'postgresql://local:password@localhost:5432/original?schema=public',
    report,
  );
  assert.equal(target.hostname, 'localhost');
  assert.equal(target.pathname, `/${database}`);
  assert.equal(target.searchParams.get('connection_limit'), '2');
});

for (const host of [
  'db.neon.tech',
  'db-pooler.neon.tech',
  '10.1.2.3',
  'localhost.evil.example',
]) {
  test(`refuses non-loopback target ${host}`, () => {
    assert.throws(
      () => restoredTarget(`postgresql://local:password@${host}/erp`, report),
      /loopback/,
    );
  });
}

for (const name of [
  'school_erp',
  'school_erp_dev',
  'school_erp;DROP TABLE users',
  '../school_erp',
  'erp_neon_drill_bad',
]) {
  test(`refuses a non-restored database identifier: ${name}`, () => {
    assert.throws(() =>
      restoredTarget('postgresql://local:password@localhost/erp', {
        ...report,
        restoredDatabase: name,
      }),
    );
  });
}

test('refuses alternate-host parameters, schemas and incomplete restore evidence', () => {
  for (const parameter of [
    'host=db.neon.tech',
    'options=unsafe',
    'schema=other',
    'pgbouncer=true',
  ]) {
    assert.throws(() =>
      restoredTarget(
        `postgresql://local:password@localhost/erp?${parameter}`,
        report,
      ),
    );
  }
  for (const change of [
    { sourceUntouched: false },
    { restoredDatabaseRetainedForInspection: false },
    { tablesVerified: 0 },
    { tablesVerified: '76' },
    { verifiedAt: 'not-a-date' },
  ]) {
    assert.throws(() =>
      restoredTarget('postgresql://local:password@localhost/erp', {
        ...report,
        ...change,
      }),
    );
  }
  assert.throws(() => restoredTarget('https://localhost/erp', report));
  assert.throws(() =>
    restoredTarget('postgresql://localhost/erp#fragment', report),
  );
  assert.throws(() => restoreReport());
  assert.throws(() => restoreReport('apps/api/.env'));
});

test('key derivation remains compatible with existing raw and hex key formats', () => {
  const raw = 'old operator-supplied encryption value';
  assert.deepEqual(
    keyFromValue(raw),
    crypto.createHash('sha256').update(raw).digest(),
  );
  const hex = crypto.randomBytes(32).toString('hex');
  assert.deepEqual(keyFromValue(hex), Buffer.from(hex, 'hex'));
  assert.throws(() => keyFromValue(''));
});

test('re-encryption authenticates old data and preserves its original bytes', () => {
  const oldKey = crypto.randomBytes(32),
    nextKey = crypto.randomBytes(32);
  const plain = Buffer.from('synthetic TOTP seed');
  const old = encryptField(plain, oldKey);
  const opened = decryptField(old, [crypto.randomBytes(32), oldKey]);
  const next = encryptField(opened, nextKey);
  assert.notEqual(next, old);
  assert.deepEqual(decryptField(next, [nextKey]), plain);
  assert.throws(() => decryptField(next, [oldKey]));
  assert.equal(next.includes(plain.toString()), false);
});

test('refuses malformed, tampered or unrecognized ciphertext without dropping it', () => {
  const key = crypto.randomBytes(32),
    value = encryptField(Buffer.from('secret'), key);
  const tampered = value.slice(0, -1) + (value.endsWith('0') ? '1' : '0');
  for (const invalid of [
    null,
    '',
    'plaintext',
    'enc:v1:aa:bb:cc',
    `${value}x`,
    tampered,
  ])
    assert.throws(() => decryptField(invalid, [key]));
  assert.throws(() => decryptField(value, [crypto.randomBytes(32)]));
});

test('generates independent secrets but retains legacy verification without rotating JWTs', () => {
  const source = { JWT_REFRESH_SECRET: 'a'.repeat(64) };
  const secrets = rotationSecrets(source);
  assert.match(secrets.PII_ENCRYPTION_KEY, /^[a-f0-9]{64}$/);
  assert.match(secrets.MFA_RECOVERY_CODE_PEPPER, /^[a-f0-9]{96}$/);
  assert.equal(
    secrets.MFA_RECOVERY_CODE_PEPPER_PREV,
    source.JWT_REFRESH_SECRET,
  );
  assert.equal(secrets.JWT_REFRESH_SECRET, undefined);
  assert.notEqual(secrets.PII_ENCRYPTION_KEY, source.JWT_REFRESH_SECRET);
  assert.notEqual(
    rotationSecrets(source).PII_ENCRYPTION_KEY,
    secrets.PII_ENCRYPTION_KEY,
  );
  assert.throws(() => rotationSecrets({}));
  assert.throws(() =>
    rotationSecrets({
      ...source,
      MFA_RECOVERY_CODE_PEPPER_PREV: 'b'.repeat(64),
    }),
  );
});

test('retains an explicitly configured old pepper rather than substituting JWT', () => {
  const secrets = rotationSecrets({
    MFA_RECOVERY_CODE_PEPPER: 'c'.repeat(64),
    JWT_REFRESH_SECRET: 'a'.repeat(64),
  });
  assert.equal(secrets.MFA_RECOVERY_CODE_PEPPER_PREV, 'c'.repeat(64));
});

test('scoped encryption settings restore inherited values on synchronous failures', () => {
  const original = process.env.PII_ENCRYPTION_KEY;
  assert.throws(() =>
    withEncryptionEnvironment({ PII_ENCRYPTION_KEY: 'temporary' }, () => {
      assert.equal(process.env.PII_ENCRYPTION_KEY, 'temporary');
      throw new Error('synthetic failure');
    }),
  );
  assert.equal(process.env.PII_ENCRYPTION_KEY, original);
});

test('scoped encryption settings survive await and are restored after async failure', async () => {
  const original = process.env.PII_ENCRYPTION_KEY;
  await assert.rejects(
    withEncryptionEnvironment({ PII_ENCRYPTION_KEY: 'temporary' }, async () => {
      await Promise.resolve();
      assert.equal(process.env.PII_ENCRYPTION_KEY, 'temporary');
      throw new Error('synthetic failure');
    }),
  );
  assert.equal(process.env.PII_ENCRYPTION_KEY, original);
});

test('the independent TOTP probe agrees with the RFC test vector', () => {
  const previous = Date.now;
  try {
    Date.now = () => 59000;
    assert.equal(testTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'), '287082');
    assert.throws(() => testTotp('invalid!'));
  } finally {
    Date.now = previous;
  }
});

test('journal writes are exclusive, encrypted, and authenticated before a commit', () => {
  const fs = require('node:fs');
  const originalWrite = fs.writeFileSync,
    originalRead = fs.readFileSync;
  let saved, writeOptions;
  const key = crypto.randomBytes(32);
  const journal = [
    { id: 'synthetic', before: 'old ciphertext', after: 'new ciphertext' },
  ];
  try {
    fs.writeFileSync = (filename, data, options) => {
      saved = Buffer.from(data);
      writeOptions = options;
    };
    fs.readFileSync = () => saved;
    saveJournal('synthetic-journal', journal, key);
    assert.equal(writeOptions.flag, 'wx');
    assert.equal(writeOptions.mode, 0o600);
    assert.equal(saved.subarray(0, 9).toString(), 'ERPLOCAL1');
    assert.equal(saved.includes(Buffer.from('old ciphertext')), false);
    fs.readFileSync = () => {
      const tampered = Buffer.from(saved);
      tampered[tampered.length - 1] ^= 1;
      return tampered;
    };
    assert.throws(() => saveJournal('synthetic-journal', journal, key));
  } finally {
    fs.writeFileSync = originalWrite;
    fs.readFileSync = originalRead;
  }
});

function fixture(options = {}) {
  const oldKey = crypto.randomBytes(32),
    newKey = crypto.randomBytes(32);
  const old = encryptField(Buffer.from('synthetic secret'), oldKey);
  let state = {
    rows: Object.fromEntries(
      FIELDS.map(({ table, field }, index) => [
        table,
        index === 0
          ? [
              {
                id: 'id-1',
                passwordHash: 'unchanged-hash',
                twoFactorEnabled: true,
                [field]: old,
              },
            ]
          : [],
      ]),
    ),
    audits: [{ actorId: 'original', data: 'existing immutable event' }],
    actor: null,
  };
  const digest = (rows) =>
    crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
  const tx = Object.fromEntries(
    FIELDS.map(({ model, table, field }) => [
      model,
      {
        findMany: async () =>
          state.rows[table]
            .filter((row) => row[field]?.startsWith('enc:v1:'))
            .map((row) => ({ id: row.id, [field]: row[field] })),
      },
    ]),
  );
  tx.$queryRawUnsafe = async (sql, ...args) => {
    if (sql.includes('current_database()'))
      return [{ name: options.database || database }];
    if (sql.includes('rolsuper'))
      return [{ superuser: !options.restrictedRole, bypass: false }];
    if (sql.includes('pg_advisory')) return [];
    if (sql.includes('set_config')) {
      state.actor = args[0];
      return [];
    }
    if (sql.includes('FROM pg_tables'))
      return [
        ...FIELDS.map(({ table }) => ({ name: table })),
        { name: 'domain_audit_events' },
      ];
    if (sql.includes('FROM public.domain_audit_events t')) {
      const rows = state.audits.filter((row) => row.actorId !== args[0]);
      return [{ count: rows.length, digest: digest(rows) }];
    }
    if (sql.includes('FROM domain_audit_events WHERE'))
      return [
        { count: state.audits.filter((row) => row.actorId === args[0]).length },
      ];
    const table = /FROM public\."([a-z_]+)"/.exec(sql)?.[1];
    if (sql.startsWith('SELECT count(*)')) {
      const field = FIELDS.find((entry) => entry.table === table).field;
      const rows = state.rows[table].map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(([key]) => key !== field),
        ),
      );
      return [{ count: rows.length, digest: digest(rows) }];
    }
    if (sql.startsWith('SELECT "')) {
      const field = FIELDS.find((entry) => entry.table === table).field;
      return [
        { value: state.rows[table].find((row) => row.id === args[0])[field] },
      ];
    }
    throw new Error('Unexpected synthetic SQL');
  };
  tx.$executeRawUnsafe = async (sql, ...args) => {
    if (sql.startsWith('SET LOCAL')) return 0;
    const [, table, field] =
      /^UPDATE public\."([a-z_]+)" SET "([a-zA-Z]+)"/.exec(sql);
    if (options.casFailure) return 0;
    const row = state.rows[table].find(
      (item) => item.id === args[1] && item[field] === args[2],
    );
    if (!row) return 0;
    row[field] = args[0];
    if (options.corruptPassword) row.passwordHash = 'unexpected mutation';
    if (options.corruptAudit) state.audits[0].data = 'unexpected mutation';
    if (!options.missingAudit)
      state.audits.push({ actorId: state.actor, data: 'redacted snapshot' });
    return 1;
  };
  return {
    oldKey,
    newKey,
    old,
    getState: () => structuredClone(state),
    transaction: async (work) => {
      const before = structuredClone(state);
      try {
        return await work(tx);
      } catch (error) {
        state = before;
        throw error;
      }
    },
  };
}

test('local migration changes ciphertext only, preserves plaintext and journals its rollback values', async () => {
  const f = fixture();
  const result = await f.transaction((tx) =>
    migrateFields(tx, { database, oldKeys: [f.oldKey], newKey: f.newKey }),
  );
  assert.equal(result.journal.length, 1);
  assert.equal(result.journal[0].before, f.old);
  const row = f.getState().rows.users[0];
  assert.equal(row.passwordHash, 'unchanged-hash');
  assert.equal(row.twoFactorEnabled, true);
  assert.deepEqual(
    decryptField(row.twoFactorSecret, [f.newKey]),
    Buffer.from('synthetic secret'),
  );
});

for (const [name, options] of Object.entries({
  'wrong database': { database: 'school_erp' },
  'restricted role': { restrictedRole: true },
  'concurrent update': { casFailure: true },
  'business mutation': { corruptPassword: true },
  'changed historical audit': { corruptAudit: true },
  'missing transactional audit': { missingAudit: true },
})) {
  test(`refuses and rolls back a ${name}`, async () => {
    const f = fixture(options),
      before = f.getState();
    await assert.rejects(
      f.transaction((tx) =>
        migrateFields(tx, { database, oldKeys: [f.oldKey], newKey: f.newKey }),
      ),
    );
    assert.deepEqual(f.getState(), before);
  });
}

test('unrecognized old keys and stale rehearsal fingerprints cannot commit', async () => {
  for (const override of [
    { oldKeys: [crypto.randomBytes(32)] },
    { expectedFingerprint: 'stale' },
  ]) {
    const f = fixture(),
      before = f.getState();
    await assert.rejects(
      f.transaction((tx) =>
        migrateFields(tx, {
          database,
          oldKeys: [f.oldKey],
          newKey: f.newKey,
          ...override,
        }),
      ),
    );
    assert.deepEqual(f.getState(), before);
  }
});
