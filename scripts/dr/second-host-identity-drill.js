/** Offline second-host acceptance. Never starts a restored worker or publishes ports. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { loadRecoveryArchive, drill } = require('./identity-recovery');
const { projectName, validateManifest } = require('./identity-backup-transport');
const { cleanup, validatePlan } = require('./identity-operator-window');
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
function hostProof() {
  const machine = fs.readFileSync('/etc/machine-id', 'utf8').trim();
  if (!/^[a-f0-9]{32}$/.test(machine)) throw new Error('HOST_IDENTITY_UNAVAILABLE');
  const result = spawnSync('docker', ['info', '--format', '{{.ID}}'], { encoding: 'utf8', timeout: 15000 });
  const daemon = result.stdout?.trim();
  if (result.error || result.status !== 0 || !daemon) throw new Error('DOCKER_UNAVAILABLE');
  return { machineFingerprint: sha(machine), daemonFingerprint: sha(daemon) };
}
function requireDifferentHost(source, target, project) {
  projectName(project);
  if (source?.version !== 1 || source.sourceProject !== project ||
    [source.machineFingerprint, source.daemonFingerprint, target.machineFingerprint, target.daemonFingerprint]
      .some((v) => !/^[a-f0-9]{64}$/.test(v || ''))) throw new Error('INVALID_HOST_PROOF');
  // A different container on the same machine, or remote Docker pointing back
  // to the source daemon, is NOT a second-host recovery drill.
  if (source.machineFingerprint === target.machineFingerprint || source.daemonFingerprint === target.daemonFingerprint) {
    throw new Error('SECOND_INDEPENDENT_HOST_REQUIRED');
  }
  return true;
}
async function main() {
  if (process.platform !== 'linux') throw new Error('LINUX_RECOVERY_HOST_REQUIRED');
  const [mode, file, sourceFile] = process.argv.slice(2);
  if (mode === 'source-proof') {
    const project = projectName(process.env.IDENTITY_COMPOSE_PROJECT);
    console.log(JSON.stringify({ version: 1, sourceProject: project, ...hostProof(), capturedAt: new Date().toISOString() }));
    return;
  }
  if (!['preflight', 'drill'].includes(mode) || !path.isAbsolute(file || '') || !path.isAbsolute(sourceFile || '')) {
    throw new Error('USE_PREFLIGHT_OR_DRILL_WITH_ABSOLUTE_ARCHIVE_AND_SOURCE_PROOF');
  }
  const manifest = JSON.parse(fs.readFileSync(file + '.json', 'utf8'));
  validateManifest(Buffer.from(JSON.stringify(manifest)), manifest.sourceProject, path.basename(file));
  const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8')), target = hostProof();
  requireDifferentHost(source, target, manifest.sourceProject);
  if (os.freemem() < 2 * 1024 ** 3) throw new Error('AT_LEAST_2_GIB_AVAILABLE_MEMORY_REQUIRED');
  if (mode === 'preflight') {
    console.log(JSON.stringify({ secondHostConfirmed: true, keyRead: false, restoreExecuted: false,
      sourceProject: manifest.sourceProject, databaseImage: manifest.databaseImage, identityImage: manifest.identityImage }));
    return;
  }
  if (!process.argv.includes('--confirm-isolated')) throw new Error('ISOLATED_DRILL_CONFIRMATION_REQUIRED');
  if (process.argv.includes('--synthetic-login')) throw new Error('SYNTHETIC_LOGIN_NOT_ALLOWED_FOR_SECOND_HOST_ACCEPTANCE');
  const recovered = loadRecoveryArchive(file, process.env.IDENTITY_BACKUP_KEY_FILE);
  if (!recovered.manifestPresent || recovered.bundle.project !== source.sourceProject ||
    manifest.databaseImage !== recovered.bundle.databaseImage || manifest.identityImage !== recovered.bundle.identityImage) {
    throw new Error('AUTHENTICATED_SOURCE_MISMATCH');
  }
  if (process.getuid() !== 0) throw new Error('ROOT_REQUIRED_FOR_INDEPENDENT_CLEANUP_WATCHDOG');
  let plan, planFile;
  let report;
  try {
    report = await drill(recovered.bundle, recovered.archiveHash, {
      dataOnly: true,
      beforeResources: async (resources) => {
        plan = validatePlan({ version: 1, ...resources });
        planFile = path.join(path.dirname(file), `${plan.name}-cleanup.json`);
        fs.writeFileSync(planFile, JSON.stringify(plan) + '\n', { flag: 'wx', mode: 0o600 });
        const result = spawnSync('systemd-run', ['--quiet', '--unit', plan.name + '-cleanup', '--on-active=20m',
          '--timer-property=AccuracySec=1s', process.execPath, path.join(__dirname, 'identity-operator-window.js'), 'cleanup', planFile],
        { timeout: 15000, encoding: 'utf8' });
        if (result.error || result.status !== 0) throw new Error('INDEPENDENT_CLEANUP_REQUIRED');
      },
    });
  } finally {
    if (plan) {
      // Exact label-checked reconciliation also covers an interrupted Docker response.
      cleanup(plan);
      const stopped = spawnSync('systemctl', ['stop', plan.name + '-cleanup.timer'], { timeout: 15000 });
      if (stopped.error || stopped.status !== 0) throw new Error('CLEANUP_TIMER_RECONCILIATION_REQUIRED');
    }
  }
  const evidence = { ...report, secondHostConfirmed: true, sourceHostFingerprint: source.machineFingerprint,
    recoveryHostFingerprint: target.machineFingerprint, disposableResourcesRemoved: true,
    originalHostContactedByDrill: false, manualLoginTestedOnSecondHost: false, productionAccepted: false };
  fs.writeFileSync(file + `.second-host-${Date.now()}.json`, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(evidence));
}
module.exports = { requireDifferentHost, hostProof };
if (require.main === module) main().catch(() => {
  console.error('SECOND_HOST_RECOVERY_NOT_ACCEPTED; private recovery diagnostics withheld'); process.exitCode = 1;
});
