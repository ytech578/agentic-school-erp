'use strict';
// Explicit inactive reader provisioning. No password handling or owner transfer.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function target(env) {
  const owner = new URL(env.MIGRATION_DATABASE_URL || env.NEON_DATABASE_URL);
  const runtime = new URL(env.NEON_RUNTIME_DATABASE_URL || env.DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(owner.protocol));
  assert.ok(owner.hostname.endsWith('.neon.tech') && !owner.hostname.includes('-pooler.'));
  assert.equal(owner.hostname, runtime.hostname.replace('-pooler.', '.'));
  assert.equal(decodeURIComponent(owner.username), 'school_erp_owner');
  assert.equal(decodeURIComponent(runtime.username), 'school_erp_runtime');
  assert.equal(owner.pathname, '/school_erp'); assert.equal(runtime.pathname, owner.pathname);
  assert.ok(['require', 'verify-full'].includes(owner.searchParams.get('sslmode')));
  for (const k of owner.searchParams.keys()) assert.ok(['sslmode', 'schema', 'connect_timeout', 'channel_binding', 'connection_limit', 'pool_timeout'].includes(k));
  if (owner.searchParams.has('schema')) assert.equal(owner.searchParams.get('schema'), 'public');
  for (const k of ['connection_limit', 'pool_timeout', 'connect_timeout']) if (owner.searchParams.has(k))
    assert.ok(/^\d+$/.test(owner.searchParams.get(k)) && Number(owner.searchParams.get(k)) > 0 && Number(owner.searchParams.get(k)) <= 60);
  // Prisma's native driver otherwise defaults to accepting invalid certificates.
  owner.searchParams.set('sslmode', 'require'); owner.searchParams.set('sslaccept', 'strict');
  return owner.href;
}
async function provision(tx) {
  const [d] = await tx.$queryRawUnsafe(`SELECT current_database() AS database, current_user AS actor,
    to_regclass('public.schools') IS NOT NULL AND to_regclass('public.users') IS NOT NULL
    AND to_regclass('public.domain_audit_events') IS NOT NULL AS erp`);
  assert.equal(d.database, 'school_erp'); assert.equal(d.actor, 'school_erp_owner'); assert.equal(d.erp, true);
  const [pilot] = await tx.$queryRawUnsafe("SELECT EXISTS(SELECT 1 FROM public.schools WHERE code='DEMO001') AS expected_school");
  assert.equal(pilot.expected_school, true);
  const rows = await tx.$queryRawUnsafe("SELECT 1 AS exists FROM pg_roles WHERE rolname='school_erp_backup'");
  assert.equal(rows.length, 0, 'EXISTING_BACKUP_ROLE_REQUIRES_REVIEW');
  // A failed BYPASSRLS/grant rolls back this whole transaction. Never grant admin membership as fallback.
  await tx.$executeRawUnsafe('CREATE ROLE school_erp_backup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS CONNECTION LIMIT 3');
  await tx.$executeRawUnsafe('GRANT CONNECT ON DATABASE school_erp TO school_erp_backup');
  await tx.$executeRawUnsafe('GRANT pg_read_all_data TO school_erp_backup');
  await tx.$executeRawUnsafe("ALTER ROLE school_erp_backup SET default_transaction_read_only=on");
  await tx.$executeRawUnsafe("ALTER ROLE school_erp_backup SET statement_timeout='120s'");
  await tx.$executeRawUnsafe("ALTER ROLE school_erp_backup SET idle_in_transaction_session_timeout='180s'");
  const [role] = await tx.$queryRawUnsafe(`SELECT rolcanlogin AS login, rolbypassrls AS bypass,
    rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication AS elevated,
    pg_has_role('school_erp_backup','pg_read_all_data','MEMBER') AS reader
    FROM pg_roles WHERE rolname='school_erp_backup'`);
  assert.equal(role.login, false); assert.equal(role.bypass, true); assert.equal(role.elevated, false); assert.equal(role.reader, true);
  return { created: true, loginEnabled: false, passwordSet: false, readAllTenantsForBackup: true,
    ownerCredentialTransferred: false, runtimeRoleChanged: false, applicationDataChanged: false };
}
async function main() {
  assert.ok(process.argv.includes('--confirm-create-inactive-backup-reader'));
  const root = path.resolve(__dirname, '../..');
  const env = require('dotenv').parse(fs.readFileSync(path.join(root, 'apps/api/.env')));
  const url = target(env);
  const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [path.join(root, 'apps/api')] }));
  const db = new PrismaClient({ datasourceUrl: url, log: [] }); let report;
  try { report = await db.$transaction(provision, { timeout: 30000 }); }
  catch (e) { report = { created: false, loginEnabled: false, passwordSet: false,
    transactionRolledBack: true, code: /^[A-Z0-9]{5}$/.test(e?.meta?.code || '') ? e.meta.code : 'NOT_ACCEPTED',
    ownerCredentialTransferred: false, runtimeRoleChanged: false, applicationDataChanged: false }; process.exitCode = 1; }
  finally { await db.$disconnect(); }
  const dir = path.join(root, 'backups/onboarding'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `neon-inactive-backup-role-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ verifiedAt: new Date().toISOString(), ...report }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(report));
}
module.exports = { target, provision };
if (require.main === module) main().catch(() => { console.error('NEON_BACKUP_ROLE_NOT_ACCEPTED; private diagnostics withheld'); process.exitCode = 1; });
