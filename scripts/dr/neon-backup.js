#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { withNetworkRetry, resolveAddress, pgEnvironment } = require('./backup-network');
const root = path.resolve(__dirname, '../..');
const envFile = path.join(root, 'apps/api/.env');
const header = Buffer.from('ERPBAK1');
let currentOperation = 'configuration';

function encryptArchive(plain, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([header, iv, cipher.getAuthTag(), encrypted]);
}
function decryptArchive(encrypted, key) {
  if (encrypted.length < 35 || !encrypted.subarray(0, 7).equals(header)) throw new Error('Invalid encrypted backup format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, encrypted.subarray(7, 19));
  decipher.setAuthTag(encrypted.subarray(19, 35));
  return Buffer.concat([decipher.update(encrypted.subarray(35)), decipher.final()]);
}
function execute(args, env = process.env) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, env, maxBuffer: 16 * 1024 * 1024, timeout: 180000 });
  if (result.error || result.status !== 0) {
    const error = new Error('Backup database command failed; no credentials or row contents were logged');
    error.operation = args.includes('pg_dump') ? 'pg_dump' : args.includes('pg_restore') ? 'pg_restore' : `docker_${args[0]}`;
    error.code = result.error?.code || `EXIT_${result.status}`;
    let diagnostic = (result.stderr || '').slice(0, 1200).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED_URL]');
    for (const field of ['PGHOST', 'PGHOSTADDR', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']) {
      if (env[field]) diagnostic = diagnostic.split(env[field]).join(`[${field}]`);
    }
    error.diagnostic = diagnostic;
    throw error;
  }
  return result.stdout;
}
const envArgs = ['-e', 'PGHOST', '-e', 'PGHOSTADDR', '-e', 'PGPORT', '-e', 'PGUSER', '-e', 'PGPASSWORD', '-e', 'PGDATABASE', '-e', 'PGSSLMODE', '-e', 'PGSSLROOTCERT', '-e', 'PGCONNECT_TIMEOUT', '-e', 'PGOPTIONS'];

async function databaseChecksums(db) {
  const tables = await db.$queryRawUnsafe("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const result = {};
  for (const { name } of tables) {
    if (!/^[a-z_]+$/.test(name)) throw new Error('Unexpected table identifier');
    const rows = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(COALESCE(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) AS checksum FROM public."${name}" t`);
    result[name] = rows[0];
  }
  return result;
}

async function main() {
  require('dotenv').config({ path: envFile, quiet: true });
  const mode = process.argv[2] || 'backup';
  if (mode === 'init-key') {
    if (process.env.BACKUP_ENCRYPTION_KEY) throw new Error('Backup key already exists; it was not rotated');
    fs.appendFileSync(envFile, `\nBACKUP_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}\n`);
    console.log('Backup key generated in the ignored local environment file. Preserve a separate secure copy for disaster recovery.');
    return;
  }
  if (!['backup', 'verify', 'drill'].includes(mode)) throw new Error('Use backup, verify <encrypted archive>, drill <encrypted archive>, or init-key');
  if (!/^[a-f0-9]{64}$/i.test(process.env.BACKUP_ENCRYPTION_KEY || '')) throw new Error('A 32-byte hex BACKUP_ENCRYPTION_KEY is required');
  const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY, 'hex');
  const dir = path.join(root, 'backups/neon');
  fs.mkdirSync(dir, { recursive: true });
  const nonce = crypto.randomBytes(6).toString('hex');
  const containerFile = `/tmp/erp-neon-backup-${nonce}.dump`;
  const localFile = path.join(dir, `temporary-${nonce}.dump`);
  const listFile = path.join(dir, `temporary-${nonce}.list`);
  const container = 'school_erp_postgres';
  const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [path.join(root, 'apps/api')] }));
  let primaryError;
  try {
    if (mode === 'backup') {
      const url = new URL(process.env.MIGRATION_DATABASE_URL || process.env.NEON_DATABASE_URL);
      if (!url.hostname.endsWith('.neon.tech') || url.hostname.includes('-pooler')) throw new Error('A direct Neon migration connection is required');
      let checksums;
      checksums = await withNetworkRetry(async (attempt) => {
        const address = await resolveAddress(url.hostname, attempt);
        const db = new PrismaClient({ datasourceUrl: url.href, log: [] });
        try {
        currentOperation = 'export_snapshot_and_checksums';
        return await db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
          const [snapshot] = await tx.$queryRawUnsafe('SELECT pg_export_snapshot() AS id');
          if (!/^[A-Fa-f0-9-]+$/.test(snapshot.id)) throw new Error('Invalid database snapshot');
          const expected = await databaseChecksums(tx);
          execute(['exec', ...envArgs, container, 'pg_dump', `--dbname=${url.pathname.slice(1)}`, '--format=custom', `--snapshot=${snapshot.id}`, `--file=${containerFile}`], pgEnvironment(url, address));
          return expected;
        }, { isolationLevel: 'RepeatableRead', timeout: 240000 });
        } finally { await db.$disconnect(); }
      }, { onRetry: (attempt) => console.log(JSON.stringify({ operation: 'retry_transient_network_failure', attempt })) });
      currentOperation = 'encrypt_archive';
      execute(['cp', `${container}:${containerFile}`, localFile]);
      const archive = fs.readFileSync(localFile);
      const encrypted = encryptArchive(archive, key);
      if (!decryptArchive(encrypted, key).equals(archive)) throw new Error('Encrypted backup validation failed');
      const filename = `erp-${new Date().toISOString().replace(/[:.]/g, '-')}.dump.enc`;
      const destination = path.join(dir, filename);
      fs.writeFileSync(destination, encrypted, { mode: 0o600 });
      const manifest = { createdAt: new Date().toISOString(), encryption: 'AES-256-GCM', sha256: crypto.createHash('sha256').update(encrypted).digest('hex'), tables: checksums };
      fs.writeFileSync(destination + '.json', JSON.stringify(manifest, null, 2));
      if (process.env.BACKUP_SECONDARY_DIRECTORY) {
        currentOperation = 'secondary_copy';
        const secondary = path.resolve(process.env.BACKUP_SECONDARY_DIRECTORY);
        if (!fs.existsSync(secondary) || !fs.statSync(secondary).isDirectory()) throw new Error('Secondary backup destination is unavailable; local encrypted backup was retained');
        fs.copyFileSync(destination, path.join(secondary, filename));
        fs.copyFileSync(destination + '.json', path.join(secondary, filename + '.json'));
      }
      console.log(JSON.stringify({ encryptedArchive: destination, tables: Object.keys(checksums).length, secondaryCopy: Boolean(process.env.BACKUP_SECONDARY_DIRECTORY) }));
      return;
    }
    if (!process.argv[3]) throw new Error('An explicit encrypted archive path is required');
    const archivePath = path.resolve(process.argv[3]);
    currentOperation = 'authenticate_archive';
    const encrypted = fs.readFileSync(archivePath);
    const manifest = JSON.parse(fs.readFileSync(archivePath + '.json', 'utf8'));
    if (manifest.sha256 !== crypto.createHash('sha256').update(encrypted).digest('hex')) throw new Error('Backup checksum does not match its manifest');
    fs.writeFileSync(localFile, decryptArchive(encrypted, key), { mode: 0o600 });
    execute(['cp', localFile, `${container}:${containerFile}`]);
    const list = execute(['exec', container, 'pg_restore', '-l', containerFile]);
    if (mode === 'verify') { console.log('Backup authentication, checksum, decryption and PostgreSQL archive checks passed.'); return; }
    const localUrl = new URL(process.env.LOCAL_DATABASE_URL || '');
    if (!['127.0.0.1', 'localhost'].includes(localUrl.hostname)) throw new Error('Restore drills require an explicit LOCAL_DATABASE_URL');
    const drillName = `erp_neon_drill_${Date.now()}_${nonce}`;
    const admin = new PrismaClient({ datasourceUrl: localUrl.href, log: [] });
    currentOperation = 'restore_drill';
    const drillUrl = new URL(localUrl);
    drillUrl.pathname = `/${drillName}`;
    let restored;
    try {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${drillName}"`);
      const filtered = list.split(/\r?\n/).filter((line) => !/SCHEMA - public\s/.test(line) && !/COMMENT - SCHEMA public\s/.test(line)).join('\n');
      fs.writeFileSync(listFile, filtered);
      execute(['cp', listFile, `${container}:${containerFile}.list`]);
      execute(['exec', ...envArgs, container, 'pg_restore', `--dbname=${drillName}`, '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', `--use-list=${containerFile}.list`, containerFile], pgEnvironment(drillUrl));
      restored = new PrismaClient({ datasourceUrl: drillUrl.href, log: [] });
      const actual = await restored.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
        return databaseChecksums(tx);
      }, { isolationLevel: 'RepeatableRead', timeout: 120000 });
      if (JSON.stringify(Object.keys(actual).sort()) !== JSON.stringify(Object.keys(manifest.tables).sort())) throw new Error('Restored table inventory differs from the backup');
      for (const [table, expected] of Object.entries(manifest.tables)) {
        if (JSON.stringify(actual[table]) !== JSON.stringify(expected)) throw new Error(`Restore checksum mismatch in ${table}`);
      }
      const report = { verifiedAt: new Date().toISOString(), restoredDatabase: drillName, tablesVerified: Object.keys(actual).length, sourceUntouched: true, restoredDatabaseRetainedForInspection: true };
      fs.writeFileSync(path.join(dir, `restore-drill-${nonce}.json`), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report));
    } finally { if (restored) await restored.$disconnect(); await admin.$disconnect(); }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    // Only the uniquely generated plaintext working copy is removed. The
    // encrypted archive and verification evidence are retained.
    if (fs.existsSync(localFile)) fs.unlinkSync(localFile);
    if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
    // Exact, generated paths only; never remove an archive or source database.
    try { execute(['exec', container, 'rm', '-f', containerFile, `${containerFile}.list`]); }
    catch (cleanupError) {
      console.error(JSON.stringify({ warning: 'Temporary archive cleanup failed; operator cleanup required', temporaryFile: containerFile }));
      if (!primaryError) throw cleanupError;
    }
  }
}
module.exports = { encryptArchive, decryptArchive };
if (require.main === module) main().catch((error) => {
  console.error(JSON.stringify({ error: 'Backup or restore verification failed; secrets were not logged', operation: error.operation || currentOperation, code: /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'UNSPECIFIED', diagnostic: error.diagnostic }));
  process.exitCode = 1;
});
