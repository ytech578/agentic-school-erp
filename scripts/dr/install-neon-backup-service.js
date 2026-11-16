'use strict';
// Installs disabled only; refuses replacement and never connects to a database.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { validateConfig } = require('./scheduled-neon-backup');
const { installRootFile } = require('./install-identity-backup-service');
const { readEnv } = require('./scheduled-identity-backup');
const scripts = ['scheduled-neon-backup.js', 'neon-backup-transport.js', 'scheduled-identity-backup.js',
  'identity-backup-transport.js', 'identity-recovery.js', 'neon-backup.js', 'backup-network.js'];
const units = ['school-erp-neon-backup.service', 'school-erp-neon-backup.timer',
  'school-erp-neon-backup-monitor.service', 'school-erp-neon-backup-monitor.timer'];
function execute(p, args) {
  const r = spawnSync(p, args, { encoding: 'utf8', timeout: 30000 });
  assert.ok(!r.error && r.status === 0, 'PRIVATE_INSTALL_CHECK_FAILED'); return r.stdout.trim();
}
function protectedTree(p) {
  for (let current = p; ; current = path.dirname(current)) {
    const s = fs.lstatSync(current); assert.ok(!s.isSymbolicLink() && s.uid === 0 && !(s.mode & 0o022));
    if (current === '/') break;
  }
}
function main() {
  assert.ok(process.platform === 'linux' && process.getuid() === 0);
  const [file, node, storageSource] = process.argv.slice(2);
  assert.ok([file, node, storageSource].every((p) => path.isAbsolute(p || '')));
  const c = validateConfig(JSON.parse(fs.readFileSync(file)));
  const code = '/opt/school-erp-neon-backup', config = '/etc/school-erp-neon-backup', state = '/var/lib/school-erp-neon-backup';
  assert.equal(c.stateDirectory, state); assert.equal(c.databaseEnvFile, config + '/database.env'); assert.equal(c.keyFile, config + '/recovery.key');
  assert.equal(c.storageEnvFile, config + '/storage.env');
  const version = execute(node, ['--version']); assert.match(version, /^v(?:2[246]|[3-9]\d)\./);
  protectedTree(node);
  for (const p of [code, config, state, ...units.map((u) => '/etc/systemd/system/' + u)]) assert.equal(fs.existsSync(p), false, 'EXISTING_INSTALLATION_REQUIRES_REVIEW');
  for (const p of [storageSource, c.alertEnvFile]) { const s = fs.lstatSync(p); assert.ok(s.isFile() && !s.isSymbolicLink() && !(s.mode & 0o077)); }
  const storageKeys = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET_NAME', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
  const storage = readEnv(storageSource, storageKeys);
  for (const p of ['S3_ENDPOINT', 'S3_BUCKET_NAME', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) assert.ok(storage[p]);
  const source = path.resolve(__dirname, '../../infrastructure/backups/neon');
  for (const f of scripts) fs.accessSync(path.join(__dirname, f)); for (const u of units) fs.accessSync(path.join(source, u));
  for (const p of [code, code + '/scripts', code + '/scripts/dr']) fs.mkdirSync(p, { mode: 0o755 });
  installRootFile(node, code + '/node', 0o755);
  for (const f of scripts) { installRootFile(path.join(__dirname, f), code + '/scripts/dr/' + f, 0o644); execute(code + '/node', ['--check', code + '/scripts/dr/' + f]); }
  for (const p of [config, state, state + '/archives']) fs.mkdirSync(p, { mode: 0o700 });
  fs.writeFileSync(config + '/config.json', JSON.stringify(c, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  installRootFile(path.join(source, 'database.env.example'), c.databaseEnvFile, 0o600);
  // These files are parsed as data by readEnv, never sourced by a shell.
  fs.writeFileSync(c.storageEnvFile, Object.entries(storage).map(([k, v]) => `${k}='${v}'`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  assert.deepEqual(readEnv(c.storageEnvFile, storageKeys), storage);
  const key = crypto.randomBytes(32); try { fs.writeFileSync(c.keyFile, key.toString('hex') + '\n', { flag: 'wx', mode: 0o600 }); } finally { key.fill(0); }
  for (const u of units) installRootFile(path.join(source, u), '/etc/systemd/system/' + u, 0o644);
  execute('systemd-analyze', ['verify', ...units.map((u) => '/etc/systemd/system/' + u)]); execute('systemctl', ['daemon-reload']);
  for (const p of [code, code + '/node', config, state]) protectedTree(p);
  console.log(JSON.stringify({ installed: true, timersEnabled: false, databaseConnected: false, credentialConfigured: false,
    separateRecoveryKeyGenerated: true, keyRequiresOperatorIndependentCopy: true, automaticDeletion: false }));
}
module.exports = { scripts, units, protectedTree };
if (require.main === module) { try { main(); } catch { console.error('NEON_BACKUP_INSTALL_NOT_ACCEPTED; no existing installation replaced'); process.exitCode = 1; } }
