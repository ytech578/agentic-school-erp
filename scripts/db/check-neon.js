#!/usr/bin/env node
/** Read-only inspection of an explicitly selected Neon ERP database. */
const path = require('node:path');

function validateNeonUrl(value) {
  if (!value) throw new Error('Set NEON_DATABASE_URL in apps/api/.env before checking the target.');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('NEON_DATABASE_URL is not a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('The Neon target must use PostgreSQL.');
  }
  if (!url.hostname.endsWith('.neon.tech')) {
    throw new Error('The target must be an explicitly configured Neon hostname.');
  }
  if (!url.username || !url.password || url.pathname === '/' || !url.pathname) {
    throw new Error('The target requires a role, password, and database name.');
  }
  if (!['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))) {
    throw new Error('The Neon target must require TLS (sslmode=require or stronger).');
  }
  if (url.searchParams.get('sslaccept') === 'accept_invalid_certs') {
    throw new Error('Do not disable TLS certificate validation.');
  }
  url.searchParams.set('connect_timeout', '15');
  url.searchParams.set('connection_limit', '1');
  return url;
}

async function inspectNeon(client) {
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const [identity] = await tx.$queryRawUnsafe(`
      SELECT current_database() AS database, current_user AS role,
             r.rolsuper AS superuser, r.rolbypassrls AS bypass_rls,
             pg_size_pretty(pg_database_size(current_database())) AS database_size
      FROM pg_roles r WHERE r.rolname = current_user
    `);
    const tables = await tx.$queryRawUnsafe(`
      SELECT c.relname AS name, c.relrowsecurity AS rls_enabled,
             pg_has_role(current_user, c.relowner, 'USAGE') AS owner_privileges,
             c.relforcerowsecurity AS rls_forced
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    `);
    const erpTables = ['schools', 'users', 'students', 'activity_logs'];
    const hasErpSchema = erpTables.every((name) => tables.some((table) => table.name === name));
    const rlsTables = tables.filter((table) => table.rls_enabled);
    const ownerBypass = rlsTables.some((table) => table.owner_privileges && !table.rls_forced);
    const restrictedRole = !identity.superuser && !identity.bypass_rls && !ownerBypass;
    return {
      identity,
      targetState: tables.length === 0 ? 'EMPTY_DATABASE' : hasErpSchema ? 'ERP_SCHEMA_PRESENT' : 'EXISTING_NON_ERP_SCHEMA',
      tableCount: tables.length,
      rlsEnabledTableCount: rlsTables.length,
      restrictedRuntimeRole: restrictedRole,
      migrationOrDataChangesPerformed: false,
      nextStep: tables.length === 0
        ? 'Confirm this is the dedicated ERP target before applying migrations.'
        : !hasErpSchema
          ? 'Existing unrelated tables detected. Select a dedicated ERP database before migration.'
          : !restrictedRole
            ? 'Use a separate non-owner NOBYPASSRLS runtime role before application cutover.'
            : 'Verify migration status and tenant-isolation tests before application cutover.',
    };
  }, { maxWait: 15000, timeout: 30000 });
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../apps/api/.env'), quiet: true });
  const url = validateNeonUrl(process.env.NEON_DATABASE_URL);
  const apiPath = path.resolve(__dirname, '../../apps/api');
  const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [apiPath] }));
  let client;
  try {
    client = new PrismaClient({ datasourceUrl: url.href, log: [] });
    console.log(JSON.stringify(await inspectNeon(client), null, 2));
  } catch (error) {
    // Connection errors can contain credentials or record contents. Print a
    // stable code only; never print the connection URL or raw Prisma error.
    console.error(`Neon inspection failed (${error.code || 'CONNECTION_OR_QUERY_ERROR'}). Check network access and credentials locally.`);
    process.exitCode = 1;
  } finally {
    if (client) await client.$disconnect();
  }
}

module.exports = { validateNeonUrl, inspectNeon };
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
