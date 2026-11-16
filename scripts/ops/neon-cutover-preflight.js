#!/usr/bin/env node
/** Read-only live preflight. Intentionally provides no apply/rotate option. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseArgs } = require('node:util');
const { validateNeonUrl } = require('../db/check-neon');
const {
  encryptedInventory,
  decryptField,
  keyFromValue,
} = require('./encryption-migration');
const { withEncryptionEnvironment } = require('./migrate-encryption-local');

const root = path.resolve(__dirname, '../..');

function neonTargets(source, runtime) {
  const owner = validateNeonUrl(source.NEON_DATABASE_URL);
  const app = validateNeonUrl(runtime.DATABASE_URL);
  const allowed = new Set([
    'sslmode',
    'channel_binding',
    'schema',
    'connect_timeout',
    'connection_limit',
    'pool_timeout',
    'pgbouncer',
  ]);
  for (const url of [owner, app]) {
    if (url.hash || (url.port && url.port !== '5432'))
      throw new Error('Unsupported Neon target');
    for (const name of url.searchParams.keys())
      if (!allowed.has(name)) throw new Error('Unsupported Neon URL parameter');
    if (
      url.searchParams.has('schema') &&
      url.searchParams.get('schema') !== 'public'
    )
      throw new Error('Only the ERP public schema is permitted');
  }
  if (owner.hostname.includes('-pooler.') || owner.pathname !== '/school_erp')
    throw new Error('Select the direct ERP owner connection');
  assert.equal(app.hostname.replace('-pooler.', '.'), owner.hostname);
  assert.equal(app.pathname, owner.pathname);
  if (owner.username === app.username)
    throw new Error('The API must not use owner credentials');
  assert.equal(runtime.DATABASE_RLS_ENABLED, 'true');
  return { owner, app };
}

function compatibleConfiguration(source, runtime, appCrypto) {
  for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    assert.ok(source[name]?.trim()?.length >= 32);
    assert.equal(source[name].trim(), runtime[name]?.trim());
  }
  const key = (env) =>
    withEncryptionEnvironment(
      { ...env, NODE_ENV: env.NODE_ENV || 'development' },
      () => appCrypto.getPiiEncryptionKey(),
    );
  const old = key(source),
    active = key(runtime);
  try {
    assert.deepEqual(old, active);
  } finally {
    old.fill(0);
    active.fill(0);
  }
  for (const name of [
    'PII_ENCRYPTION_KEY_PREV',
    'AADHAAR_ENCRYPTION_KEY_PREV',
    'MFA_RECOVERY_CODE_PEPPER',
    'MFA_RECOVERY_CODE_PEPPER_PREV',
  ]) {
    assert.equal(source[name] || '', runtime[name] || '');
  }
}

async function inspectCutover(owner, runtime, targets, oldKeys) {
  const inventory = await owner.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const [identity] = await tx.$queryRawUnsafe(
        'SELECT current_database() AS name, current_user AS role',
      );
      assert.equal(identity.name, 'school_erp');
      assert.equal(identity.role, decodeURIComponent(targets.owner.username));
      const [migrations] = await tx.$queryRawUnsafe(
        'SELECT count(*)::int AS count FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL',
      );
      assert.equal(migrations.count, 0);
      const rows = await encryptedInventory(tx);
      let authenticated = 0;
      for (const entry of rows)
        for (const row of entry.rows) {
          decryptField(row[entry.field], oldKeys).fill(0);
          authenticated++;
        }
      const [sessions] = await tx.$queryRawUnsafe(
        'SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND usename=$1 AND pid<>pg_backend_pid()',
        decodeURIComponent(targets.app.username),
      );
      const [tables] = await tx.$queryRawUnsafe(
        "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'",
      );
      return {
        tables: tables.count,
        users: await tx.user.count(),
        enrolledMfaUsers: await tx.user.count({
          where: { twoFactorEnabled: true },
        }),
        encryptedFieldsAuthenticated: authenticated,
        runtimeConnectionsAtInspection: sessions.count,
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 60000 },
  );
  await runtime.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const [role] = await tx.$queryRawUnsafe(
        'SELECT current_database() AS name, current_user AS role, rolsuper AS superuser, rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user',
      );
      assert.equal(role.name, 'school_erp');
      assert.equal(role.role, decodeURIComponent(targets.app.username));
      assert.equal(role.superuser, false);
      assert.equal(role.bypass, false);
      const [ownership] = await tx.$queryRawUnsafe(
        "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND pg_has_role(current_user,c.relowner,'USAGE')",
      );
      assert.equal(ownership.count, 0);
      const [unscoped] = await tx.$queryRawUnsafe(
        'SELECT count(*)::int AS count FROM public.schools',
      );
      assert.equal(unscoped.count, 0);
    },
    { timeout: 30000 },
  );
  return {
    ...inventory,
    runtimeRoleRestricted: true,
    unscopedTenantAccessDenied: true,
  };
}

async function main() {
  // Reject unknown flags, including --apply, before opening any connection.
  parseArgs({ options: {} });
  const dotenv = require('dotenv');
  const source = dotenv.parse(
    fs.readFileSync(path.join(root, 'apps/api/.env')),
  );
  const runtime = dotenv.parse(
    fs.readFileSync(path.join(root, 'apps/api/.env.runtime')),
  );
  const targets = neonTargets(source, runtime);
  const appCrypto = require(
    path.join(root, 'apps/api/dist/core/security/crypto.util.js'),
  );
  compatibleConfiguration(source, runtime, appCrypto);
  const oldKeys = [
    withEncryptionEnvironment(
      { ...source, NODE_ENV: source.NODE_ENV || 'development' },
      () => appCrypto.getPiiEncryptionKey(),
    ),
  ];
  const previous =
    source.PII_ENCRYPTION_KEY_PREV || source.AADHAAR_ENCRYPTION_KEY_PREV;
  if (previous) oldKeys.push(keyFromValue(previous));
  const { PrismaClient } = require(
    require.resolve('@prisma/client', { paths: [path.join(root, 'apps/api')] }),
  );
  const owner = new PrismaClient({
    datasourceUrl: targets.owner.href,
    log: [],
  });
  const runtimeClient = new PrismaClient({
    datasourceUrl: targets.app.href,
    log: [],
  });
  try {
    const checks = await inspectCutover(owner, runtimeClient, targets, oldKeys);
    const evidence = {
      checkedAt: new Date().toISOString(),
      readOnly: true,
      liveChangesApplied: false,
      ...checks,
      cutoverAccepted: false,
      pending: [
        'Independent encrypted backup and separate key custody',
        'Authenticated VM access and checked deployment artifacts',
        'Quiesce all ERP processes before coordinated database/configuration migration',
        'Reviewed live migration and paired ciphertext/configuration rollback',
        'Real browser password and MFA acceptance',
      ],
    };
    const directory = path.join(root, 'backups/security-migration');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const report = path.join(directory, `neon-preflight-${Date.now()}.json`);
    fs.writeFileSync(report, JSON.stringify(evidence, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    console.log(JSON.stringify({ ...evidence, report }, null, 2));
  } finally {
    for (const key of oldKeys) key.fill(0);
    await Promise.all([owner.$disconnect(), runtimeClient.$disconnect()]);
  }
}
module.exports = { neonTargets, compatibleConfiguration, inspectCutover };
if (require.main === module)
  main().catch(() => {
    console.error(
      'Read-only Neon preflight failed or was refused. No database records or active environment files were changed; no credentials were logged.',
    );
    process.exitCode = 1;
  });
