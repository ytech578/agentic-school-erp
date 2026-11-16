const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const FIELDS = Object.freeze([
  { model: 'user', table: 'users', field: 'twoFactorSecret' },
  { model: 'student', table: 'students', field: 'aadhaarNumber' },
  { model: 'guardian', table: 'guardians', field: 'aadhaarNumber' },
  { model: 'staff', table: 'staff', field: 'aadhaarNumber' },
  {
    model: 'identityProvider',
    table: 'identity_providers',
    field: 'clientSecretEncrypted',
  },
]);

function restoredTarget(localUrl, report) {
  const url = new URL(localUrl);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.hash
  )
    throw new Error('Only literal loopback PostgreSQL targets are permitted');
  const allowed = new Set([
    'schema',
    'sslmode',
    'connection_limit',
    'pool_timeout',
    'connect_timeout',
  ]);
  for (const name of url.searchParams.keys()) {
    if (!allowed.has(name))
      throw new Error('Unsupported local connection parameter');
  }
  if (
    url.searchParams.has('schema') &&
    url.searchParams.get('schema') !== 'public'
  )
    throw new Error('Only the restored public schema is permitted');
  if (
    !report ||
    !/^erp_neon_drill_\d{13}_[a-f0-9]{12}$/.test(report.restoredDatabase) ||
    report.sourceUntouched !== true ||
    report.restoredDatabaseRetainedForInspection !== true ||
    !Number.isInteger(report.tablesVerified) ||
    report.tablesVerified < 1 ||
    !Number.isFinite(Date.parse(report.verifiedAt))
  )
    throw new Error('A successful isolated restore report is required');
  // The report supplies a database identifier, never a host or connection URL.
  url.pathname = `/${report.restoredDatabase}`;
  url.searchParams.set('connection_limit', '2');
  return url;
}

function keyFromValue(raw) {
  if (typeof raw !== 'string' || !raw)
    throw new Error('Missing encryption key');
  return /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : crypto.createHash('sha256').update(raw).digest();
}

function encryptField(plain, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return `enc:v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptField(value, keys) {
  const match =
    /^enc:v1:([a-f0-9]{24}):([a-f0-9]{32}):((?:[a-f0-9]{2})+)$/i.exec(
      value || '',
    );
  if (!match) throw new Error('Invalid encrypted-field envelope');
  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(match[1], 'hex'),
      );
      decipher.setAuthTag(Buffer.from(match[2], 'hex'));
      return Buffer.concat([
        decipher.update(Buffer.from(match[3], 'hex')),
        decipher.final(),
      ]);
    } catch {
      /* Try an explicitly configured previous key, never discard a record. */
    }
  }
  throw new Error('An existing encrypted field cannot be authenticated');
}

function rotationSecrets(source) {
  if (source.MFA_RECOVERY_CODE_PEPPER_PREV)
    throw new Error(
      'Finish the existing recovery-code rotation before starting another',
    );
  const previous =
    source.MFA_RECOVERY_CODE_PEPPER || source.JWT_REFRESH_SECRET?.trim();
  if (!previous || previous.length < 32)
    throw new Error('The previous recovery-code pepper must be available');
  return {
    PII_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    MFA_RECOVERY_CODE_PEPPER: crypto.randomBytes(48).toString('hex'),
    MFA_RECOVERY_CODE_PEPPER_PREV: previous,
  };
}

async function assertTargetDatabase(tx, name) {
  const [current] = await tx.$queryRawUnsafe(
    'SELECT current_database() AS name',
  );
  if (
    current.name !== name ||
    !/^erp_neon_drill_\d{13}_[a-f0-9]{12}$/.test(current.name)
  )
    throw new Error(
      'Database identity does not match the verified local restore',
    );
  const [role] = await tx.$queryRawUnsafe(
    'SELECT rolsuper AS superuser, rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user',
  );
  if (!role?.superuser && !role?.bypass)
    throw new Error(
      'A local restore administrator is required for complete verification',
    );
}

/** Excludes only the intended encryption columns; every other business value is hashed. */
async function invariantFingerprint(tx) {
  const tables = await tx.$queryRawUnsafe(
    "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const result = {};
  for (const { name } of tables) {
    if (!/^[a-z_]+$/.test(name))
      throw new Error('Unexpected restored table identifier');
    if (name === 'domain_audit_events') continue;
    const field = FIELDS.find((entry) => entry.table === name)?.field;
    const payload = field ? `to_jsonb(t) - '${field}'` : 'to_jsonb(t)';
    const [row] = await tx.$queryRawUnsafe(
      `SELECT count(*)::int AS count, md5(COALESCE(string_agg(p::text,E'\\n' ORDER BY p::text),'')) AS digest ` +
        `FROM (SELECT ${payload} AS p FROM public."${name}" t) data`,
    );
    result[name] = row;
  }
  return result;
}

async function encryptedInventory(tx) {
  const result = [];
  for (const field of FIELDS) {
    const rows = await tx[field.model].findMany({
      where: { [field.field]: { startsWith: 'enc:v1:' } },
      select: { id: true, [field.field]: true },
      orderBy: { id: 'asc' },
      take: 10001,
    });
    // Fail closed rather than attempting an unbounded production-size operation.
    if (rows.length > 10000)
      throw new Error('Local rehearsal record limit exceeded');
    result.push({ ...field, rows });
  }
  return result;
}

function inventoryFingerprint(inventory) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(inventory))
    .digest('hex');
}

async function auditFingerprint(tx, excludedActor) {
  const [result] = await tx.$queryRawUnsafe(
    "SELECT count(*)::int AS count, md5(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) AS digest " +
      'FROM public.domain_audit_events t' +
      (excludedActor ? ' WHERE "actorId" IS DISTINCT FROM $1' : ''),
    ...(excludedActor ? [excludedActor] : []),
  );
  return result;
}

async function rotateVerifiedFields(
  tx,
  { database, oldKeys, newKey, expectedFingerprint, expectedInvariant },
  { assertTarget, operation },
) {
  assert.equal(typeof assertTarget, 'function');
  assert.match(operation, /^[a-z][a-z0-9-]{5,80}$/);
  await assertTarget(tx, database);
  await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
  await tx.$queryRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))::text',
    operation,
  );
  const actor = `${operation}:${crypto.randomUUID()}`;
  await tx.$queryRawUnsafe(
    "SELECT set_config('app.current_user_id',$1,true)",
    actor,
  );
  const invariantBefore = await invariantFingerprint(tx);
  if (expectedInvariant) assert.deepEqual(invariantBefore, expectedInvariant);
  const auditBefore = await auditFingerprint(tx, actor);
  const inventory = await encryptedInventory(tx);
  if (
    expectedFingerprint &&
    inventoryFingerprint(inventory) !== expectedFingerprint
  )
    throw new Error(
      'The restored encrypted records changed since the rehearsal',
    );
  const journal = [];
  for (const entry of inventory) {
    for (const row of entry.rows) {
      const before = row[entry.field];
      const plain = decryptField(before, oldKeys);
      let verified;
      try {
        const after = encryptField(plain, newKey);
        verified = decryptField(after, [newKey]);
        assert.ok(crypto.timingSafeEqual(plain, verified));
        const changed = await tx.$executeRawUnsafe(
          `UPDATE public."${entry.table}" SET "${entry.field}"=$1 WHERE id=$2 AND "${entry.field}"=$3`,
          after,
          row.id,
          before,
        );
        if (changed !== 1)
          throw new Error(
            'Concurrent encrypted-field change; transaction refused',
          );
        const [stored] = await tx.$queryRawUnsafe(
          `SELECT "${entry.field}" AS value FROM public."${entry.table}" WHERE id=$1`,
          row.id,
        );
        assert.equal(stored.value, after);
        journal.push({
          table: entry.table,
          field: entry.field,
          id: row.id,
          before,
          after,
        });
      } finally {
        plain.fill(0);
        if (verified) verified.fill(0);
      }
    }
  }
  assert.deepEqual(await invariantFingerprint(tx), invariantBefore);
  assert.deepEqual(await auditFingerprint(tx, actor), auditBefore);
  const [events] = await tx.$queryRawUnsafe(
    'SELECT count(*)::int AS count FROM domain_audit_events WHERE "actorId"=$1',
    actor,
  );
  assert.equal(events.count, journal.length);
  return {
    journal,
    invariant: invariantBefore,
    originalFingerprint: inventoryFingerprint(inventory),
  };
}

async function migrateFields(tx, options) {
  // This entry point always keeps the original local-restore-only guard.
  return rotateVerifiedFields(tx, options, {
    assertTarget: assertTargetDatabase,
    operation: 'local-encryption-rehearsal',
  });
}

module.exports = {
  FIELDS,
  restoredTarget,
  keyFromValue,
  encryptField,
  decryptField,
  rotationSecrets,
  assertTargetDatabase,
  invariantFingerprint,
  encryptedInventory,
  inventoryFingerprint,
  auditFingerprint,
  migrateFields,
  rotateVerifiedFields,
};
