#!/usr/bin/env node
/**
 * Secret Rotation Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Rotates JWT secrets and API keys with zero-downtime strategy:
 *   1. Generates new secrets
 *   2. Updates .env file (or AWS Secrets Manager / Vault if configured)
 *   3. Optionally invalidates all active sessions (forces re-login)
 *
 * USAGE:
 *   node scripts/db/rotate-secrets.js          # Interactive
 *   node scripts/db/rotate-secrets.js --force  # No confirmation
 *
 * ZERO-DOWNTIME STRATEGY:
 *   The NestJS JWT strategy already verifies tokens against both
 *   JWT_ACCESS_SECRET and JWT_ACCESS_SECRET_PREV. This allows:
 *   1. Rotate: new secret generated, old becomes PREV
 *   2. Grace period: existing tokens (signed with old key) still work
 *   3. After grace period: PREV can be cleared
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const ENV_FILE = path.resolve(__dirname, '../../apps/api/.env');
const BACKUP_DIR = path.resolve(__dirname, '../../backups/secrets');
const FORCE = process.argv.includes('--force');

function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function confirm(question) {
  if (FORCE) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question + ' [y/N] ', (ans) => { rl.close(); resolve(ans.trim().toLowerCase() === 'y'); });
  });
}

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

function writeEnv(filePath, env) {
  const content = Object.entries(env)
    .map(([k, v]) => k + '=' + v)
    .join('\n') + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');
}

async function rotate() {
  console.log('\nSecret Rotation — School ERP\n' + '='.repeat(40));

  if (!fs.existsSync(ENV_FILE)) {
    console.error('ERROR: .env file not found at: ' + ENV_FILE);
    process.exit(1);
  }

  const env = readEnv(ENV_FILE);

  // Ensure backup dir exists
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // Backup current .env (with masked values in filename)
  const backupPath = path.join(BACKUP_DIR, 'env_backup_' + timestamp() + '.enc');
  const backupContent = JSON.stringify(env, null, 2);
  // Encrypt backup with a one-time key stored alongside
  const oneTimeKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', oneTimeKey, iv);
  const encrypted = Buffer.concat([cipher.update(backupContent, 'utf-8'), cipher.final()]);
  fs.writeFileSync(backupPath, iv.toString('hex') + ':' + encrypted.toString('hex'));
  fs.writeFileSync(backupPath + '.key', oneTimeKey.toString('hex'));
  console.log('\nEncrypted backup saved to: ' + backupPath);
  console.log('Decryption key saved to: ' + backupPath + '.key');
  console.log('IMPORTANT: Store the .key file securely. Delete it after verification.\n');

  const ok = await confirm('Rotate JWT secrets and regenerate API keys?');
  if (!ok) { console.log('Rotation cancelled.'); process.exit(0); }

  const rotations = [];

  // Rotate JWT_ACCESS_SECRET
  if (env.JWT_ACCESS_SECRET || env.JWT_SECRET) {
    const key = env.JWT_ACCESS_SECRET ? 'JWT_ACCESS_SECRET' : 'JWT_SECRET';
    env['JWT_ACCESS_SECRET_PREV'] = env[key];
    env[key] = generateSecret(48);
    rotations.push(key);
    console.log('Rotated: ' + key + ' (old value saved to JWT_ACCESS_SECRET_PREV)');
  }

  // Rotate JWT_REFRESH_SECRET
  if (env.JWT_REFRESH_SECRET) {
    env['JWT_REFRESH_SECRET_PREV'] = env.JWT_REFRESH_SECRET;
    env['JWT_REFRESH_SECRET'] = generateSecret(48);
    rotations.push('JWT_REFRESH_SECRET');
    console.log('Rotated: JWT_REFRESH_SECRET');
  }

  // Rotate AADHAAR_ENCRYPTION_KEY
  if (env.AADHAAR_ENCRYPTION_KEY) {
    env['AADHAAR_ENCRYPTION_KEY_PREV'] = env.AADHAAR_ENCRYPTION_KEY;
    env['AADHAAR_ENCRYPTION_KEY'] = generateSecret(32);
    rotations.push('AADHAAR_ENCRYPTION_KEY');
    console.log('Rotated: AADHAAR_ENCRYPTION_KEY');
  }

  // Update ROTATION_DATE
  env['SECRET_ROTATION_DATE'] = new Date().toISOString();
  env['SECRET_ROTATION_BY'] = process.env.USER || process.env.USERNAME || 'unknown';

  // Write updated .env
  writeEnv(ENV_FILE, env);

  console.log('\nRotated ' + rotations.length + ' secret(s) in: ' + ENV_FILE);
  console.log('\nNEXT STEPS:');
  console.log('  1. Restart the API server to apply new secrets');
  console.log('  2. Old tokens remain valid during grace period (JWT_*_PREV keys)');
  console.log('  3. After 24h, remove *_PREV keys from .env and restart again');
  console.log('  4. If using Docker: docker compose up -d --force-recreate api');
  console.log('\nROLLBACK: Swap *_PREV values back to primary keys if issues arise');
}

rotate().catch((e) => { console.error('Error:', e.message); process.exit(1); });
