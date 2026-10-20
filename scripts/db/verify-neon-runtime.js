#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../apps/api/.env'), quiet: true });
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [path.resolve(__dirname, '../../apps/api')] }));

async function context(tx, schoolId) {
  await tx.$queryRawUnsafe("SELECT set_config('app.current_school_id',$1,true), set_config('app.current_user_id','verification-probe',true), set_config('app.bypass_rls','off',true), set_config('app.is_platform_admin','off',true)", schoolId);
}
async function main() {
  if (!process.env.NEON_RUNTIME_DATABASE_URL) throw new Error('Configure the restricted Neon runtime URL first');
  const owner = new PrismaClient({ datasourceUrl: process.env.NEON_DATABASE_URL, log: [] });
  const runtime = new PrismaClient({ datasourceUrl: process.env.NEON_RUNTIME_DATABASE_URL, log: [] });
  try {
    const [role] = await runtime.$queryRawUnsafe(`SELECT rolsuper AS superuser, rolbypassrls AS bypass_rls FROM pg_roles WHERE rolname=current_user`);
    assert.equal(role.superuser, false);
    assert.equal(role.bypass_rls, false);
    const [unscoped] = await runtime.$queryRawUnsafe('SELECT count(*)::int AS count FROM schools');
    assert.equal(unscoped.count, 0);
    const schools = await owner.$queryRawUnsafe('SELECT id FROM schools ORDER BY id');
    assert.ok(schools.length > 0, 'No migrated schools are available for the verification');
    for (const school of schools) {
      await runtime.$transaction(async (tx) => {
        await context(tx, school.id);
        const visible = await tx.$queryRawUnsafe('SELECT id FROM schools');
        assert.deepEqual(visible.map((row) => row.id), [school.id]);
        const unexpected = await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM users WHERE "schoolId" IS DISTINCT FROM $1', school.id);
        assert.equal(unexpected[0].count, 0);
      });
    }
    let blocked = false;
    try {
      await runtime.$transaction(async (tx) => {
        await context(tx, schools[0].id);
        await tx.$executeRawUnsafe('INSERT INTO schools (id,name,code,"updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP)', randomUUID(), 'RLS rollback probe', randomUUID());
      });
    } catch (error) { blocked = error?.meta?.code === '42501'; }
    assert.equal(blocked, true, 'A cross-tenant insert was not denied by PostgreSQL');

    let transactionId;
    try {
      await runtime.$transaction(async (tx) => {
        await context(tx, schools[0].id);
        const ids = await tx.$queryRawUnsafe('SELECT txid_current()::text AS id');
        transactionId = ids[0].id;
        await tx.$executeRawUnsafe('UPDATE schools SET name=name WHERE id=$1', schools[0].id);
        const snapshots = await tx.$queryRawUnsafe('SELECT "before", "after" FROM domain_audit_events WHERE "transactionId"=$1::bigint', transactionId);
        assert.equal(snapshots.length, 1);
        assert.deepEqual(snapshots[0].before, snapshots[0].after);
        const users = await tx.$queryRawUnsafe('SELECT id FROM users LIMIT 1');
        if (users.length) {
          await tx.$executeRawUnsafe('UPDATE users SET "firstName"="firstName" WHERE id=$1', users[0].id);
          const [redaction] = await tx.$queryRawUnsafe('SELECT "after"->>\'passwordHash\' AS password FROM domain_audit_events WHERE "transactionId"=$1::bigint AND "tableName"=\'users\'', transactionId);
          assert.equal(redaction.password, '[REDACTED]');
        }
        throw new Error('EXPECTED_VERIFICATION_ROLLBACK');
      });
    } catch (error) { if (error.message !== 'EXPECTED_VERIFICATION_ROLLBACK') throw error; }
    const [rolledBack] = await owner.$queryRawUnsafe('SELECT count(*)::int AS count FROM domain_audit_events WHERE "transactionId"=$1::bigint', transactionId);
    assert.equal(rolledBack.count, 0, 'Audit events escaped a rolled-back business transaction');
    let immutable = false;
    try { await runtime.$executeRawUnsafe('DELETE FROM domain_audit_events WHERE false'); }
    catch (error) { immutable = error?.meta?.code === '42501'; }
    assert.equal(immutable, true, 'Runtime role can delete audit events');
    const report = { checkedAt: new Date().toISOString(), restrictedRole: true, unscopedAccessDenied: true, tenantsVerified: schools.length, crossTenantWriteDenied: true, atomicAuditSnapshots: true, secretRedactionVerified: true, auditRollbackVerified: true, auditDeletionDenied: true };
    fs.writeFileSync(path.resolve(__dirname, '../../backups/db/neon-runtime-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await owner.$disconnect(); await runtime.$disconnect(); }
}
main().catch(() => { console.error('Neon runtime verification failed. Application cutover must not proceed.'); process.exitCode = 1; });
