/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { PrismaClient } = require('../../apps/api/node_modules/@prisma/client');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const databaseName = `school_erp_migration_test_${Date.now()}_${randomBytes(3).toString('hex')}`;
  if (!/^school_erp_migration_test_[a-z0-9_]+$/.test(databaseName)) {
    throw new Error('Generated database name failed its safety check');
  }

  const admin = new PrismaClient();
  let created = false;
  let target;
  let rlsRoleName;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;

    const targetUrl = new URL(process.env.DATABASE_URL);
    targetUrl.pathname = `/${databaseName}`;
    const apiDirectory = path.resolve(__dirname, '../../apps/api');
    const prismaCli = path.resolve(
      apiDirectory,
      'node_modules/prisma/build/index.js',
    );
    const result = spawnSync(
      process.execPath,
      [prismaCli, 'migrate', 'deploy'],
      {
        cwd: apiDirectory,
        env: { ...process.env, DATABASE_URL: targetUrl.href },
        encoding: 'utf8',
        stdio: 'pipe',
      },
    );
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Migration verification failed with exit code ${result.status}`);
    }

    // Exercise RLS as a real NOBYPASSRLS role. Running migration SQL as the
    // database owner alone cannot prove that tenant policies are effective.
    target = new PrismaClient({ datasourceUrl: targetUrl.href });
    rlsRoleName = `${databaseName}_rls`;
    if (!/^school_erp_migration_test_[a-z0-9_]+_rls$/.test(rlsRoleName)) {
      throw new Error('Generated RLS role name failed its safety check');
    }
    await target.$executeRawUnsafe(
      `CREATE ROLE "${rlsRoleName}" NOLOGIN NOBYPASSRLS`,
    );
    await target.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA public, app_security TO "${rlsRoleName}"`,
    );
    await target.$executeRawUnsafe(
      `GRANT SELECT ON TABLE "schools" TO "${rlsRoleName}"`,
    );
    await target.$executeRawUnsafe(`
      INSERT INTO "schools" ("id", "name", "code", "updatedAt") VALUES
        ('rls-school-a', 'RLS School A', 'RLS_A_${databaseName}', CURRENT_TIMESTAMP),
        ('rls-school-b', 'RLS School B', 'RLS_B_${databaseName}', CURRENT_TIMESTAMP)
    `);
    const tenantRows = await target.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL ROLE "${rlsRoleName}"`);
      await transaction.$queryRaw`
        SELECT
          set_config('app.current_school_id', 'rls-school-a', true),
          set_config('app.is_platform_admin', 'off', true),
          set_config('app.bypass_rls', 'off', true)
      `;
      return transaction.$queryRaw`SELECT "id" FROM "schools" ORDER BY "id"`;
    });
    if (
      tenantRows.length !== 1 ||
      tenantRows[0]?.id !== 'rls-school-a'
    ) {
      throw new Error('PostgreSQL RLS tenant-isolation assertion failed');
    }
    console.log('PostgreSQL RLS verified with a real NOBYPASSRLS role.');

    const printDiffScript = process.env.PRINT_MIGRATION_DIFF === 'true';
    const drift = spawnSync(
      process.execPath,
      [
        prismaCli,
        'migrate',
        'diff',
        '--from-url',
        targetUrl.href,
        '--to-schema-datamodel',
        path.resolve(apiDirectory, 'prisma/schema.prisma'),
        printDiffScript ? '--script' : '--exit-code',
      ],
      {
        cwd: apiDirectory,
        env: { ...process.env, DATABASE_URL: targetUrl.href },
        encoding: 'utf8',
        stdio: 'pipe',
      },
    );
    process.stdout.write(drift.stdout || '');
    process.stderr.write(drift.stderr || '');
    if (drift.error) throw drift.error;
    if (drift.status !== 0) {
      throw new Error(`Migration/schema drift verification failed with exit code ${drift.status}`);
    }
    if (printDiffScript) {
      return;
    }
    console.log(`Migration chain verified in temporary database ${databaseName}.`);
  } finally {
    if (target) {
      await target.$disconnect();
    }
    if (created) {
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      console.log(`Removed temporary database ${databaseName}.`);
    }
    if (rlsRoleName) {
      await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS "${rlsRoleName}"`);
    }
    await admin.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
