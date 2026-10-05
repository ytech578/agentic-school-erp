#!/usr/bin/env node
/**
 * Database Migration Management Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides safe migration lifecycle operations:
 *   - status   : Show current migration state
 *   - migrate  : Apply pending migrations (with auto-backup)
 *   - rollback : Restore from a named snapshot (pg_restore)
 *   - backup   : Create a timestamped pg_dump snapshot
 *   - restore  : Restore from an explicit snapshot file
 *   - list     : List all available backups
 *
 * USAGE:
 *   node scripts/db/migrate.js status
 *   node scripts/db/migrate.js backup
 *   node scripts/db/migrate.js migrate
 *   node scripts/db/migrate.js rollback ./backups/db/pre_migrate_2024-10-15.sql
 *   node scripts/db/migrate.js list
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

require('dotenv').config({ path: path.resolve(__dirname, '../../apps/api/.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set in apps/api/.env');
  process.exit(1);
}

const BACKUP_DIR = path.resolve(__dirname, '../../backups/db');
const PRISMA_DIR = path.resolve(__dirname, '../../apps/api');

function run(cmd, opts = {}) {
  console.log('\n> ' + cmd);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question + ' [y/N] ', (ans) => { rl.close(); resolve(ans.trim().toLowerCase() === 'y'); });
  });
}

function parseDatabaseUrl(url) {
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/);
  if (!m) throw new Error('Cannot parse DATABASE_URL');
  return { user: m[1], password: m[2], host: m[3], port: m[4] || '5432', db: m[5] };
}

async function status() {
  run('npx prisma migrate status', { cwd: PRISMA_DIR });
}

async function backup(label = 'manual') {
  ensureBackupDir();
  const { user, password, host, port, db } = parseDatabaseUrl(DATABASE_URL);
  const filename = label + '_' + timestamp() + '.sql';
  const filePath = path.join(BACKUP_DIR, filename);
  console.log('\nCreating backup: ' + filename);
  const env = { ...process.env, PGPASSWORD: password };
  run('pg_dump -h ' + host + ' -p ' + port + ' -U ' + user + ' -d ' + db + ' -F p -f "' + filePath + '"', { env });
  console.log('\nBackup saved: ' + filePath);
  return filePath;
}

async function migrate() {
  console.log('\nRunning database migrations...');
  const backupPath = await backup('pre_migrate');
  const ok = await confirm('\nMigration backup created. Proceed with migration?');
  if (!ok) { console.log('Cancelled. Backup retained at: ' + backupPath); process.exit(0); }
  run('npx prisma migrate deploy', { cwd: PRISMA_DIR });
  console.log('\nMigrations applied. Rollback: node scripts/db/migrate.js rollback "' + backupPath + '"');
}

async function rollback(snapshotPath) {
  if (!snapshotPath) { console.error('ERROR: Usage: node scripts/db/migrate.js rollback <path>'); process.exit(1); }
  const resolved = path.resolve(snapshotPath);
  if (!fs.existsSync(resolved)) { console.error('ERROR: File not found: ' + resolved); process.exit(1); }
  console.log('\nROLLBACK to: ' + resolved);
  const ok = await confirm('This will DROP and recreate the database. Are you sure?');
  if (!ok) { console.log('Rollback cancelled.'); process.exit(0); }
  const { user, password, host, port, db } = parseDatabaseUrl(DATABASE_URL);
  const env = { ...process.env, PGPASSWORD: password };
  run('psql -h ' + host + ' -p ' + port + ' -U ' + user + ' -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=\'' + db + '\' AND pid<>pg_backend_pid();"', { env });
  run('dropdb -h ' + host + ' -p ' + port + ' -U ' + user + ' --if-exists ' + db, { env });
  run('createdb -h ' + host + ' -p ' + port + ' -U ' + user + ' ' + db, { env });
  run('psql -h ' + host + ' -p ' + port + ' -U ' + user + ' -d ' + db + ' -f "' + resolved + '"', { env });
  console.log('\nDatabase restored from: ' + resolved);
}

function listBackups() {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sql')).sort().reverse();
  if (files.length === 0) { console.log('No backups in: ' + BACKUP_DIR); return; }
  console.log('\nBackups in ' + BACKUP_DIR + ':\n');
  files.forEach((f, i) => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    console.log('  ' + (i + 1) + '. ' + f + '  (' + (stat.size / 1024 / 1024).toFixed(2) + ' MB)');
  });
}

const [,, command, ...args] = process.argv;
(async () => {
  try {
    switch (command) {
      case 'status':   await status(); break;
      case 'backup':   await backup(args[0]); break;
      case 'migrate':  await migrate(); break;
      case 'rollback': await rollback(args[0]); break;
      case 'restore':  await rollback(args[0]); break;
      case 'list':     listBackups(); break;
      default:
        console.log('Usage: node scripts/db/migrate.js [status|backup|migrate|rollback|restore|list] [args]');
    }
  } catch (e) { console.error('Error:', e.message); process.exit(1); }
})();
