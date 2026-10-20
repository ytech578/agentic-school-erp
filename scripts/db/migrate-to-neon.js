#!/usr/bin/env node
/** Restore a checked local archive into the explicitly selected, empty ERP DB. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
const { validateNeonUrl } = require('./check-neon');
const root = path.resolve(__dirname, '../..');
const envFile = path.join(root, 'apps/api/.env');
require('dotenv').config({ path: envFile, quiet: true });
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [path.join(root, 'apps/api')] }));
const backupFile = path.join(root, 'backups/db/erp-pre-enterprise-20261018.dump');
const containerArchive = '/tmp/erp-pre-enterprise-20261018.dump';
const containerName = 'school_erp_postgres';

function command(exe, args, options = {}) {
  const result = spawnSync(exe, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) {
    const headings = (result.stderr || '').split(/\r?\n/).filter((line) => /^(pg_restore: error:|psql: error:|ERROR:)/.test(line)).map((line) => line.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]').replace(/password\s*=\s*\S+/gi, 'password=[REDACTED]')).slice(0, 3);
    if (headings.length) console.error(headings.join('\n'));
    // Never expose credentials or restored row contents from command stderr.
    throw new Error(`${path.basename(exe)} failed (${result.status ?? 'launch'}). No credentials or record contents were logged.`);
  }
  return result.stdout;
}

async function tables(db) {
  return db.$queryRawUnsafe("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
}

async function checksums(db, names) {
  const result = {};
  for (const name of names) {
    if (!/^[a-z_]+$/.test(name)) throw new Error('Unexpected table identifier');
    const rows = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), '')) AS checksum FROM public."${name}" t`);
    result[name] = rows[0];
  }
  return result;
}

async function main() {
  const mode = process.argv[2] || '--plan';
  if (!['--plan', '--restore', '--reconcile', '--configure-runtime'].includes(mode)) throw new Error('Use --plan, --restore, --reconcile, or --configure-runtime');
  const targetUrl = validateNeonUrl(process.env.NEON_DATABASE_URL);
  if (targetUrl.hostname.includes('-pooler') || decodeURIComponent(targetUrl.pathname) !== '/school_erp') throw new Error('Use the direct owner connection for the dedicated school_erp database');
  const target = new PrismaClient({ datasourceUrl: targetUrl.href, log: [] });
  try {
    const existing = await tables(target);
    console.log(JSON.stringify({ mode, database: 'school_erp', existingTables: existing.length, destructiveResetAllowed: false }));
    if (mode === '--plan') return;
    if (mode === '--configure-runtime') return await configureRuntime(target, targetUrl);
    if (mode === '--restore' && existing.length !== 0) throw new Error('Target is not empty. Restore refused; no tables were overwritten.');
    if (mode === '--reconcile' && !['users', 'user_sessions', 'activity_logs', '_prisma_migrations'].every((name) => existing.some((table) => table.name === name))) throw new Error('Reconciliation requires the already-restored ERP schema');
    const sourceUrl = new URL(process.env.DATABASE_URL);
    if (!['localhost', '127.0.0.1'].includes(sourceUrl.hostname)) throw new Error('The verified source must still be local PostgreSQL');
    if (!fs.existsSync(backupFile)) throw new Error('The verified local archive is missing');
    const source = new PrismaClient({ datasourceUrl: sourceUrl.href, log: [] });
    let before;
    try {
      const names = (await tables(source)).map((t) => t.name).filter((name) => name !== '_prisma_migrations');
      before = await checksums(source, names);
      if (mode === '--reconcile') {
        // Only reconcile the three volatile authentication tables after the
        // local writer has been stopped. No reset, truncation, or deletion.
        const stable = names.filter((name) => !['users', 'user_sessions', 'activity_logs'].includes(name));
        const targetStable = await checksums(target, stable);
        if (stable.some((name) => JSON.stringify(before[name]) !== JSON.stringify(targetStable[name]))) throw new Error('Business data changed since the archive. Reconciliation refused.');
        await target.$transaction(async (tx) => {
          for (const name of ['users', 'user_sessions', 'activity_logs']) {
            const records = await source.$queryRawUnsafe(`SELECT row_to_json(t) AS row FROM public."${name}" t`);
            const columns = await source.$queryRawUnsafe('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position', 'public', name);
            const update = columns.filter((column) => column.column_name !== 'id').map((column) => {
              if (!/^[a-zA-Z_]+$/.test(column.column_name)) throw new Error('Unexpected column identifier');
              return `"${column.column_name}"=EXCLUDED."${column.column_name}"`;
            }).join(',');
            await tx.$executeRawUnsafe(`INSERT INTO public."${name}" SELECT * FROM json_populate_recordset(NULL::public."${name}", $1::json) ON CONFLICT (id) DO UPDATE SET ${update}`, JSON.stringify(records.map((record) => record.row)));
          }
        }, { timeout: 120000 });
      }
    } finally { await source.$disconnect(); }
    if (mode === '--restore') {
    const manifest = command('docker', ['exec', containerName, 'pg_restore', '-l', containerArchive]);
    // Neon already owns its public schema; restore every other archive entry.
    const filtered = manifest.split(/\r?\n/).filter((line) => !/SCHEMA - public\s/.test(line) && !/COMMENT - SCHEMA public\s/.test(line)).join('\n');
    const manifestFile = path.join(root, 'backups/db/neon-restore-manifest.list');
    fs.writeFileSync(manifestFile, filtered);
    command('docker', ['cp', manifestFile, `${containerName}:/tmp/neon-restore-manifest.list`]);
    const connectionEnv = { ...process.env, PGHOST: targetUrl.hostname, PGPORT: targetUrl.port || '5432', PGUSER: decodeURIComponent(targetUrl.username), PGPASSWORD: decodeURIComponent(targetUrl.password), PGDATABASE: 'school_erp', PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15', PGOPTIONS: '-c timezone=UTC' };
    command('docker', ['exec', '-e', 'PGHOST', '-e', 'PGPORT', '-e', 'PGUSER', '-e', 'PGPASSWORD', '-e', 'PGDATABASE', '-e', 'PGSSLMODE', '-e', 'PGCONNECT_TIMEOUT', '-e', 'PGOPTIONS', containerName, 'pg_restore', '--dbname=school_erp', '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', '--use-list=/tmp/neon-restore-manifest.list', containerArchive], { env: connectionEnv });
    }
    const after = await checksums(target, Object.keys(before));
    const mismatches = Object.keys(before).filter((name) => JSON.stringify(before[name]) !== JSON.stringify(after[name]));
    if (mismatches.length) throw new Error(`Row count/checksum mismatch in: ${mismatches.join(', ')}. Application cutover refused.`);
    const prismaCli = require.resolve('prisma/build/index.js', { paths: [path.join(root, 'apps/api')] });
    command(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: path.join(root, 'apps/api'), env: { ...process.env, DATABASE_URL: targetUrl.href } });
    const report = { verifiedAt: new Date().toISOString(), target: 'school_erp', backupSha256: createHash('sha256').update(fs.readFileSync(backupFile)).digest('hex'), tablesVerified: Object.keys(before).length, totalRowsVerified: Object.values(before).reduce((sum, item) => sum + item.count, 0), checksums: after, migrationsApplied: true, localSourcePreserved: true, applicationCutover: false };
    fs.writeFileSync(path.join(root, 'backups/db/neon-migration-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ tablesVerified: report.tablesVerified, totalRowsVerified: report.totalRowsVerified, migrationsApplied: true, applicationCutover: false }));
  } finally { await target.$disconnect(); }
}

async function configureRuntime(target, targetUrl) {
  const roleName = 'school_erp_runtime';
  const found = await target.$queryRawUnsafe('SELECT rolname FROM pg_roles WHERE rolname=$1', roleName);
  if (found.length) throw new Error('Runtime role already exists; credentials were not reset. Inspect the existing configuration.');
  const password = randomBytes(36).toString('base64url');
  await target.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE ROLE "${roleName}" LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT PASSWORD '${password}'`);
    for (const sql of [
      `GRANT CONNECT ON DATABASE school_erp TO "${roleName}"`,
      `GRANT USAGE ON SCHEMA public, app_security TO "${roleName}"`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${roleName}"`,
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${roleName}"`,
      `GRANT EXECUTE ON FUNCTION app_security.has_tenant_access(TEXT) TO "${roleName}"`,
      `REVOKE INSERT, UPDATE, DELETE ON domain_audit_events FROM "${roleName}"`,
      `REVOKE ALL ON _prisma_migrations FROM "${roleName}"`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${roleName}"`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${roleName}"`,
    ]) await tx.$executeRawUnsafe(sql);
  });
  const runtime = new URL(targetUrl);
  runtime.hostname = runtime.hostname.replace(/^(ep-[^.]+)\./, '$1-pooler.');
  runtime.username = roleName;
  runtime.password = password;
  runtime.searchParams.set('connection_limit', '5');
  const envText = fs.readFileSync(envFile, 'utf8');
  // Generated secret configuration is backed up and mechanically rewritten;
  // secrets never pass through shell command text or console output.
  const backup = path.join(root, 'backups/db/api-env-before-neon.env');
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, envText, { mode: 0o600 });
  const updates = { NEON_RUNTIME_DATABASE_URL: runtime.href, MIGRATION_DATABASE_URL: targetUrl.href };
  let changed = envText;
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}="${value}"`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    changed = pattern.test(changed) ? changed.replace(pattern, () => line) : changed.trimEnd() + '\n' + line + '\n';
  }
  fs.writeFileSync(envFile, changed, { mode: 0o600 });
  console.log('Restricted runtime role created. Its pooled URL was saved locally; active DATABASE_URL is unchanged pending verification.');
}

main().catch((error) => {
  if (error.code) console.error(JSON.stringify({ errorCode: error.code, databaseCode: error.meta?.code, category: String(error.meta?.message || error.meta?.error || '').split('\n')[0].replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED]').slice(0, 240) }));
  const safe = error instanceof Error && !error.message.includes('prisma') && !error.message.includes('postgres') ? error.message : 'Database operation failed; connection secrets and record contents were suppressed.';
  console.error(safe);
  process.exitCode = 1;
});
