/** Explicit Linux installation only. NEVER enables a timer or stops a service. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateConfig } = require('./scheduled-identity-backup');
const root = path.resolve(__dirname, '../..');
const destination = '/opt/school-erp-backup';
const configDirectory = '/etc/school-erp-backup';
const stateDirectory = '/var/lib/school-erp-identity-backup';
const scripts = ['identity-recovery.js', 'neon-backup.js', 'backup-network.js',
  'scheduled-identity-backup.js', 'identity-backup-transport.js', 'second-host-identity-drill.js', 'identity-operator-window.js'];
const units = ['school-erp-identity-backup.service', 'school-erp-identity-backup.timer',
  'school-erp-identity-backup-monitor.service', 'school-erp-identity-backup-monitor.timer'];
function execute(program, args) {
  const result = spawnSync(program, args, { encoding: 'utf8', timeout: 30000 });
  if (result.error || result.status !== 0) throw new Error('INSTALL_VALIDATION_FAILED');
  return result.stdout.trim();
}
function installRootFile(source, target, mode, io = fs) {
  io.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  // Copy implementations/filesystems may retain source ownership. A root
  // service must not execute ordinary-user-owned code, even under /opt.
  io.chownSync(target, 0, 0);
  io.chmodSync(target, mode);
}
function main() {
  if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('LINUX_ROOT_INSTALL_REQUIRED');
  const [configFile, nodeFile] = process.argv.slice(2);
  if (![configFile, nodeFile].every((f) => path.isAbsolute(f || ''))) throw new Error('ABSOLUTE_CONFIG_AND_VENDOR_NODE_REQUIRED');
  const config = validateConfig(JSON.parse(fs.readFileSync(configFile, 'utf8')));
  if (config.stateDirectory !== stateDirectory || config.alertEnvFile !== path.join(configDirectory, 'alerts.env')) throw new Error('SERVICE_PATHS_MUST_MATCH');
  const version = execute(nodeFile, ['--version']);
  if (!/^v(?:2[246]|[3-9]\d)\./.test(version)) throw new Error('SUPPORTED_VENDOR_NODE_REQUIRED');
  // Refuse every conflicting target BEFORE making any change. No overwrite/upgrades by this installer.
  for (const target of [destination, configDirectory, stateDirectory, ...units.map((u) => '/etc/systemd/system/' + u)]) {
    if (fs.existsSync(target)) throw new Error('EXISTING_INSTALLATION_REQUIRES_REVIEW');
  }
  for (const file of scripts.map((f) => path.join(__dirname, f))) fs.accessSync(file, fs.constants.R_OK);
  const unitSource = path.join(root, 'infrastructure/backups/identity');
  units.forEach((u) => fs.accessSync(path.join(unitSource, u), fs.constants.R_OK));
  fs.mkdirSync(destination, { mode: 0o755 });
  fs.mkdirSync(path.join(destination, 'scripts'), { mode: 0o755 });
  fs.mkdirSync(path.join(destination, 'scripts/dr'), { mode: 0o755 });
  installRootFile(nodeFile, path.join(destination, 'node'), 0o755);
  for (const name of scripts) {
    const target = path.join(destination, 'scripts/dr', name);
    installRootFile(path.join(__dirname, name), target, 0o644);
    execute(path.join(destination, 'node'), ['--check', target]);
  }
  fs.mkdirSync(configDirectory, { mode: 0o700 });
  fs.mkdirSync(stateDirectory, { mode: 0o700 });
  fs.mkdirSync(path.join(stateDirectory, 'archives'), { mode: 0o700 });
  fs.writeFileSync(path.join(configDirectory, 'config.json'), JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  installRootFile(path.join(unitSource, 'alerts.env.example'), config.alertEnvFile, 0o600);
  for (const name of units) {
    const target = '/etc/systemd/system/' + name;
    installRootFile(path.join(unitSource, name), target, 0o644);
  }
  execute('systemd-analyze', ['verify', ...units.map((u) => '/etc/systemd/system/' + u)]);
  execute('systemctl', ['daemon-reload']);
  console.log(JSON.stringify({ installed: true, timersEnabled: false, servicesStarted: false,
    nodeVersion: version, alertCredentialsConfigured: false, automaticDeletion: false,
    liveAcceptanceStillRequiresApprovedManualBackupAndDeliveredTestAlert: true }));
}
module.exports = { main, installRootFile };
if (require.main === module) {
  try { main(); } catch { console.error('BACKUP_INSTALL_NOT_ACCEPTED; no existing installation replaced'); process.exitCode = 1; }
}
