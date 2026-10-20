#!/usr/bin/env node
/** Activate only a migration and runtime connection that passed verification. */
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../..');
const envFile = path.join(root, 'apps/api/.env');
const text = fs.readFileSync(envFile, 'utf8');
const env = dotenv.parse(text);
const migration = JSON.parse(fs.readFileSync(path.join(root, 'backups/db/neon-migration-verification.json'), 'utf8'));
const runtime = JSON.parse(fs.readFileSync(path.join(root, 'backups/db/neon-runtime-verification.json'), 'utf8'));
if (!migration.migrationsApplied || !runtime.auditRollbackVerified || !runtime.crossTenantWriteDenied || !runtime.restrictedRole) throw new Error('Database verification is incomplete; activation refused');
const url = new URL(env.NEON_RUNTIME_DATABASE_URL || '');
if (!url.hostname.endsWith('.neon.tech') || decodeURIComponent(url.username) !== 'school_erp_runtime' || url.pathname !== '/school_erp') throw new Error('Unexpected runtime target');
const updates = {
  LOCAL_DATABASE_URL: env.LOCAL_DATABASE_URL || env.DATABASE_URL,
  DATABASE_URL: url.href,
  DATABASE_RLS_ENABLED: 'true',
  PRISMA_TRANSACTION_TIMEOUT_MS: '30000',
  MALWARE_SCAN_REQUIRED: 'true',
  CLAMAV_HOST: '127.0.0.1',
  CLAMAV_PORT: '3310',
  BREAK_GLASS_REQUIRED: 'true',
};
let changed = text;
for (const [key, value] of Object.entries(updates)) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  changed = pattern.test(changed) ? changed.replace(pattern, () => line) : changed.trimEnd() + '\n' + line + '\n';
}
fs.writeFileSync(envFile, changed, { mode: 0o600 });
console.log('Verified Neon runtime activated. Local connection retained as LOCAL_DATABASE_URL. RLS, scanner enforcement and break-glass checks enabled.');
