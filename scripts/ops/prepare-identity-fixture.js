/** Owns only a newly named LOCAL synthetic ERP fixture; never migrates Neon. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'backups/identity');
require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
const apiRequire = require('node:module').createRequire(path.join(root, 'apps/api/package.json'));
const { PrismaClient } = apiRequire('@prisma/client');
async function main() {
  const source = new URL(process.env.LOCAL_DATABASE_URL || '');
  if (!['localhost', '127.0.0.1'].includes(source.hostname)) throw new Error('Explicit local database URL required');
  const secret = JSON.parse(fs.readFileSync(path.join(directory, 'development-secrets.json'), 'utf8'));
  const stateFile = path.join(directory, 'fixture.json');
  let fixture;
  if (fs.existsSync(stateFile)) fixture = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  else {
    const suffix = crypto.randomBytes(5).toString('hex');
    fixture = { database: `erp_identity_test_${suffix}`, runtimeRole: `erp_identity_runtime_${suffix}`, piiKey: crypto.randomBytes(32).toString('hex'), jwtAccess: crypto.randomBytes(40).toString('hex'), jwtRefresh: crypto.randomBytes(40).toString('hex'), schoolId: `identity-school-${suffix}`, secondSchoolId: `identity-other-${suffix}`, adminId: `identity-admin-${suffix}`, schoolCode: `IDENTITY_${suffix.toUpperCase()}` };
    fs.writeFileSync(stateFile, JSON.stringify(fixture), { flag: 'wx', mode: 0o600 });
  }
  if (!/^erp_identity_test_[a-f0-9]{10}$/.test(fixture.database) || !/^erp_identity_runtime_[a-f0-9]{10}$/.test(fixture.runtimeRole)) throw new Error('Fixture identity failed validation');
  const owner = new PrismaClient({ datasourceUrl: source.href, log: [] });
  const targetUrl = new URL(source); targetUrl.pathname = '/' + fixture.database;
  let target;
  try {
    const exists = await owner.$queryRawUnsafe('SELECT datname FROM pg_database WHERE datname=$1', fixture.database);
    if (!exists.length) await owner.$executeRawUnsafe(`CREATE DATABASE "${fixture.database}"`);
    const prismaCli = apiRequire.resolve('prisma/build/index.js');
    const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: path.join(root, 'apps/api'), env: { ...process.env, DATABASE_URL: targetUrl.href }, encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error('Synthetic database migrations failed');
    target = new PrismaClient({ datasourceUrl: targetUrl.href, log: [] });
    const roles = await target.$queryRawUnsafe('SELECT rolname FROM pg_roles WHERE rolname=$1', fixture.runtimeRole);
    if (!roles.length) await target.$executeRawUnsafe(`CREATE ROLE "${fixture.runtimeRole}" LOGIN NOBYPASSRLS NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE PASSWORD '${secret.runtimePassword}'`);
    await target.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${fixture.database}" TO "${fixture.runtimeRole}"`);
    await target.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public,app_security TO "${fixture.runtimeRole}"`);
    await target.$executeRawUnsafe(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${fixture.runtimeRole}"`);
    await target.$executeRawUnsafe(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${fixture.runtimeRole}"`);
    await target.$executeRawUnsafe(`REVOKE INSERT,UPDATE,DELETE ON domain_audit_events FROM "${fixture.runtimeRole}"`);
    await target.$executeRawUnsafe(`REVOKE ALL ON _prisma_migrations FROM "${fixture.runtimeRole}"`);
    for (const [id, code] of [[fixture.schoolId, fixture.schoolCode], [fixture.secondSchoolId, fixture.schoolCode + '_OTHER']]) {
      await target.school.upsert({ where: { id }, create: { id, name: 'Synthetic Identity Test School', code }, update: {} });
    }
    await target.user.upsert({ where: { id: fixture.adminId }, create: { id: fixture.adminId, schoolId: fixture.schoolId, email: 'fixture-admin@erp-identity.invalid', passwordHash: await apiRequire('bcryptjs').hash(secret.fixturePassword, 10), firstName: 'Synthetic', lastName: 'Administrator', role: 'SCHOOL_ADMIN', status: 'ACTIVE', emailVerified: true }, update: {} });
    const runtime = new URL(targetUrl); runtime.username = fixture.runtimeRole; runtime.password = secret.runtimePassword;
    const values = { NODE_ENV: 'development', ERP_DEPLOYMENT_MODE: 'development', APP_RUNTIME_ENV_ONLY: 'true', DATABASE_URL: runtime.href, DATABASE_RLS_ENABLED: 'true', REDIS_URL: 'redis://127.0.0.1:6381', PORT: '4100', APP_URL: 'http://localhost:3100', API_URL: 'http://localhost:4100', CORS_ORIGIN: 'http://localhost:3100', JWT_ACCESS_SECRET: fixture.jwtAccess, JWT_REFRESH_SECRET: fixture.jwtRefresh, PII_ENCRYPTION_KEY: fixture.piiKey, MFA_RECOVERY_CODE_PEPPER: crypto.createHash('sha256').update(fixture.piiKey + 'recovery').digest('hex'), MFA_ISSUER: 'Synthetic ERP Identity Test', MALWARE_SCAN_REQUIRED: 'true', CLAMAV_HOST: 'localhost', CLAMAV_PORT: '3310', STORAGE_DRIVER: 'local', STORAGE_LOCAL_PATH: path.join(directory, 'uploads'), PRISMA_TRANSACTION_TIMEOUT_MS: '30000', NODE_EXTRA_CA_CERTS: path.join(directory, 'tls/ca.pem') };
    fs.writeFileSync(path.join(directory, 'erp-test.env'), Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value || '')}`).join('\n') + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ syntheticLocalDatabaseReady: true, database: fixture.database, restrictedRole: fixture.runtimeRole, apiPort: 4100, realSchoolDataUsed: false }));
  } finally { if (target) await target.$disconnect(); await owner.$disconnect(); }
}
main().catch(() => { console.error('Identity fixture setup failed; existing ERP databases were not reset and secrets were not logged.'); process.exitCode = 1; });
