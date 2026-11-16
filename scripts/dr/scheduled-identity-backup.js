/** Linux host service: ciphertext-only transport, independent resume watchdog, no retention deletes. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { sourceContainers } = require('./identity-recovery');
const { projectName, validateManifest } = require('./identity-backup-transport');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const s3Keys = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET_NAME', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASSWORD', 'BACKUP_ALERT_EMAIL'];
function validateConfig(c) {
  const keys = ['project', 'stateDirectory', 'keyFile', 'storageEnvFile', 'alertEnvFile',
    'dependencyImage', 'discoveryUrl', 'issuer'];
  if (!c || JSON.stringify(Object.keys(c).sort()) !== JSON.stringify(keys.sort())) throw new Error('INVALID_CONFIG');
  projectName(c.project);
  for (const field of ['stateDirectory', 'keyFile', 'storageEnvFile', 'alertEnvFile']) {
    if (typeof c[field] !== 'string' || !path.posix.isAbsolute(c[field]) || /[\r\n,\x00]/.test(c[field]) ||
      c[field].split('/').includes('..') || c[field] === '/') throw new Error('INVALID_PRIVATE_PATH');
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(c.dependencyImage)) throw new Error('IMMUTABLE_IMAGE_REQUIRED');
  const issuer = new URL(c.issuer), discovery = new URL(c.discoveryUrl);
  if ([issuer, discovery].some((u) => u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) ||
    !c.issuer.endsWith('/') || c.discoveryUrl !== c.issuer + '.well-known/openid-configuration') throw new Error('INVALID_DISCOVERY');
  return c;
}
function privateFile(file) {
  const s = fs.lstatSync(file);
  if (!s.isFile() || s.isSymbolicLink() || (process.platform === 'linux' && (s.mode & 0o077))) throw new Error('PRIVATE_FILE_PERMISSIONS_REQUIRED');
}
function privateDirectory(dir) {
  const s = fs.lstatSync(dir);
  if (!s.isDirectory() || s.isSymbolicLink() || (s.mode & 0o077)) throw new Error('PRIVATE_DIRECTORY_REQUIRED');
}
function atomicJson(file, value) {
  const temporary = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file);
    // Directory fsync is supported on the Linux service host, not Windows test hosts.
    if (process.platform !== 'win32') {
      const dir = fs.openSync(path.dirname(file), 'r');
      try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
    }
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function readEnv(file, allowed) {
  privateFile(file);
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf('=');
    const name = line.slice(0, index).trim();
    if (index < 1 || !/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('INVALID_ENV_FILE');
    if (!allowed.includes(name)) continue; // Never inherit unrelated application/owner secrets.
    if (Object.hasOwn(env, name)) throw new Error('DUPLICATED_ENV_KEY');
    let value = line.slice(index + 1).trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      if (value.at(-1) !== value[0]) throw new Error('INVALID_ENV_QUOTING');
      value = value.slice(1, -1);
    }
    if (/[\x00\r\n]/.test(value)) throw new Error('INVALID_ENV_VALUE');
    env[name] = value; // No interpolation, shell expansion or source/eval.
  }
  return env;
}
function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
    timeout: 30000, ...options });
  if (result.error || result.status !== 0) throw new Error('PRIVATE_COMMAND_FAILED');
  return result.stdout;
}
function readStatus(c) {
  const file = path.join(c.stateDirectory, 'status.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}
function inspect(id) { return JSON.parse(command('docker', ['inspect', id]))[0]; }
function planFor(c, containers) {
  return { version: 1, project: c.project, createdAt: new Date().toISOString(),
    containers: ['server', 'worker'].map((service) => {
      const item = containers[service];
      if (!item?.State.Running || item.State.Health?.Status !== 'healthy') throw new Error('SOURCE_NOT_HEALTHY');
      return { id: item.Id, service };
    }) };
}
function validatePlan(p, c) {
  if (p?.version !== 1 || p.project !== c.project || !Array.isArray(p.containers) || p.containers.length !== 2 ||
    new Set(p.containers.map((i) => i.id)).size !== 2 ||
    JSON.stringify(p.containers.map((i) => i.service).sort()) !== JSON.stringify(['server', 'worker']) ||
    p.containers.some((i) => !/^[a-f0-9]{64}$/.test(i.id))) throw new Error('INVALID_RESUME_PLAN');
  return p;
}
function planFingerprint(plan) { return sha(Buffer.from(JSON.stringify(plan))); }
function consumePlan(file, expected) {
  try {
    if (planFingerprint(JSON.parse(fs.readFileSync(file, 'utf8'))) !== planFingerprint(expected)) throw new Error('RESUME_PLAN_CHANGED');
    fs.unlinkSync(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false; // An identical concurrent resume already consumed it.
    throw error;
  }
}
function matchingContainer(item, project) {
  const container = inspect(item.id);
  if (container.Id !== item.id || container.Config.Labels?.['com.docker.compose.project'] !== project ||
    container.Config.Labels?.['com.docker.compose.service'] !== item.service) throw new Error('SOURCE_IDENTITY_CHANGED');
  return container;
}
async function resume(plan, c) {
  validatePlan(plan, c);
  // Validate ALL identities before touching either. Never target names or broad Compose operations.
  plan.containers.forEach((item) => matchingContainer(item, c.project));
  const failures = [];
  for (const item of plan.containers) {
    try { command('docker', ['start', item.id]); } catch { failures.push(item.service); }
  }
  if (failures.length) throw new Error('SOURCE_RESUME_FAILED');
  for (let n = 0; n < 60; n++) {
    if (plan.containers.every((item) => {
      const container = matchingContainer(item, c.project);
      return container.State.Running && container.State.Health?.Status === 'healthy';
    })) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('SOURCE_RESUME_UNHEALTHY');
}
async function performBackup(ops) {
  // Independent watchdog MUST exist before the first stop. A thrown/partial stop
  // still resumes both originally healthy services; upload never extends outage.
  await ops.arm();
  let archive;
  try { await ops.stop(); archive = await ops.backup(); }
  finally {
    await ops.resume();
    await ops.disarm(); // Also disarm after a failed backup once healthy resume succeeds.
  }
  await ops.probe();
  const receipt = await ops.upload(archive);
  if (receipt?.remoteCopyVerified !== true) throw new Error('REMOTE_COPY_UNVERIFIED');
  return { archive, receipt };
}
function transport(c, mode, archive = null, input = undefined) {
  const credentials = readEnv(mode === 'alert' ? c.alertEnvFile : c.storageEnvFile,
    mode === 'alert' ? smtpKeys : s3Keys);
  const transfer = fs.mkdtempSync(path.join(c.stateDirectory, 'transfer-'));
  const copied = [];
  try {
    fs.chownSync(transfer, 65532, 65532); fs.chmodSync(transfer, 0o700);
    if (archive) {
      for (const file of [archive, archive + '.json']) {
        privateFile(file);
        const dest = path.join(transfer, path.basename(file));
        fs.copyFileSync(file, dest, fs.constants.COPYFILE_EXCL); copied.push(dest);
        fs.chownSync(dest, 65532, 65532); fs.chmodSync(dest, 0o400);
      }
    }
    const args = ['run', '--rm', '-i', '--pull=never', '--read-only', '--user=65532:65532',
      '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory=512m', '--memory-swap=512m',
      '--cpus=0.5', '--pids-limit=64', '--log-driver=none',
      '--mount', `type=bind,src=${path.join(__dirname, 'identity-backup-transport.js')},dst=/app/identity-backup-transport.js,readonly`,
      '--mount', `type=bind,src=${transfer},dst=/transfer,readonly`,
      ...Object.keys(credentials).flatMap((name) => ['-e', name]),
      '--entrypoint=node', c.dependencyImage, '/app/identity-backup-transport.js', mode, c.project,
      ...(archive ? [path.basename(archive)] : [])];
    return JSON.parse(command('docker', args, { env: { PATH: process.env.PATH, ...credentials },
      input, timeout: mode === 'alert' ? 60000 : 240000 }));
  } finally {
    // Only ciphertext staging copies, never retained backups/keys; no recursive removal.
    copied.forEach((file) => fs.unlinkSync(file)); fs.rmdirSync(transfer);
  }
}
function health(status, c, now = Date.now(), maxAgeHours = 26) {
  const failures = [];
  const success = status.lastSuccess;
  if (status.project && status.project !== c.project) failures.push('STATUS_PROJECT_MISMATCH');
  if (status.lastRun?.ok !== true) failures.push('LATEST_RUN_NOT_SUCCESSFUL');
  const verified = Date.parse(success?.completedAt), created = Date.parse(success?.backupCreatedAt);
  if (!Number.isFinite(verified) || !Number.isFinite(created) || verified > now || created > verified ||
    now - verified > maxAgeHours * 3600000 || now - created > maxAgeHours * 3600000) failures.push('BACKUP_MISSING_OR_STALE');
  if (success?.remoteCopyVerified !== true || !Array.isArray(success?.objects) || success.objects.length !== 2 ||
    success.objects.some((o) => o.downloadedAndVerified !== true)) failures.push('REMOTE_COPY_UNVERIFIED');
  try {
    if (!success || path.dirname(success.archive) !== path.join(c.stateDirectory, 'archives')) throw new Error();
    privateFile(success.archive); privateFile(success.archive + '.json');
    const m = validateManifest(fs.readFileSync(success.archive + '.json'), c.project, path.basename(success.archive), now);
    if (fs.statSync(success.archive).size !== m.archive.bytes || sha(fs.readFileSync(success.archive)) !== m.archive.sha256 ||
      success.backupCreatedAt !== m.createdAt) throw new Error();
    const expected = [
      { key: `identity-backups/${c.project}/${m.archive.file}`, sha256: m.archive.sha256, bytes: m.archive.bytes },
      { key: `identity-backups/${c.project}/${m.archive.file}.json`, sha256: sha(fs.readFileSync(success.archive + '.json')),
        bytes: fs.statSync(success.archive + '.json').size },
    ];
    if (!expected.every((e) => success.objects?.some((o) => o.key === e.key && o.sha256 === e.sha256 && o.bytes === e.bytes))) throw new Error();
  } catch { failures.push('LOCAL_ARCHIVE_OR_RECEIPT_INVALID'); }
  return { healthy: failures.length === 0, codes: failures };
}
async function monitor(c, notify, test = false) {
  let status;
  try { status = readStatus(c); } catch { status = { lastRun: { ok: false, code: 'STATUS_UNREADABLE' } }; }
  const result = test ? { healthy: false, codes: ['TEST_ALERT_ONLY'] } : health(status, c);
  if (!result.healthy && notify) {
    const signature = sha(Buffer.from(result.codes.join(',')));
    const last = status.lastAlert;
    const age = Date.now() - Date.parse(last?.attemptedAt);
    // Failed SMTP delivery is retried by the hourly monitor; no false alert-success.
    if (test || last?.signature !== signature || last?.acceptedBySmtp !== true || !(age >= 0 && age < 6 * 3600000)) {
      let accepted = false;
      try { accepted = transport(c, 'alert', null, JSON.stringify({ project: c.project, codes: result.codes })).acceptedBySmtp === true; }
      catch { /* Never include SMTP diagnostics, recipient or passwords in logs. */ }
      if (!test) {
        status.lastAlert = { signature, attemptedAt: new Date().toISOString(), acceptedBySmtp: accepted, inboxDeliveryVerified: false };
        atomicJson(path.join(c.stateDirectory, 'status.json'), status);
      }
      return { ...result, alertAcceptedBySmtp: accepted, inboxDeliveryVerified: false };
    }
  }
  return result;
}
async function run(c, configFile) {
  const statusFile = path.join(c.stateDirectory, 'status.json');
  const planFile = path.join(c.stateDirectory, 'resume-plan.json');
  const unit = `erp-identity-resume-${crypto.randomBytes(8).toString('hex')}`;
  let previous;
  try { previous = readStatus(c); } catch { throw new Error('STATUS_UNREADABLE_STOP'); }
  const startedAt = new Date().toISOString();
  atomicJson(statusFile, { ...previous, project: c.project, lastRun: { startedAt, ok: false, code: 'RUNNING' } });
  let stage = 'PREFLIGHT';
  try {
    privateFile(c.keyFile); privateFile(c.storageEnvFile); privateFile(c.alertEnvFile);
    if (fs.existsSync(planFile)) throw new Error('UNCONSUMED_RESUME_PLAN_STOP');
    if (!/^[a-f0-9]{64}$/i.test(fs.readFileSync(c.keyFile, 'utf8').trim())) throw new Error('INVALID_KEY');
    command('docker', ['image', 'inspect', c.dependencyImage]);
    const source = sourceContainers(c.project, { requireStopped: false });
    if (!source.db.State.Running || source.db.State.Health?.Status !== 'healthy') throw new Error('DATABASE_NOT_HEALTHY');
    const plan = planFor(c, source); atomicJson(planFile, plan);
    const result = await performBackup({
      arm: () => {
        stage = 'ARM_WATCHDOG';
        command('systemd-run', ['--quiet', `--unit=${unit}`, '--on-active=6m', '--timer-property=AccuracySec=1s',
          '--property=RuntimeMaxSec=3min', '--property=MemoryMax=256M', '--property=NoNewPrivileges=true',
          process.execPath, __filename, 'resume', configFile, planFingerprint(plan)]);
      },
      stop: () => {
        stage = 'STOP_SOURCE';
        for (const service of ['worker', 'server']) {
          const item = plan.containers.find((i) => i.service === service); matchingContainer(item, c.project);
          command('docker', ['stop', '--time', '30', item.id], { timeout: 45000 });
        }
      },
      backup: () => {
        stage = 'ENCRYPT_BACKUP';
        const output = command(process.execPath, [path.join(__dirname, 'identity-recovery.js'), 'backup'],
          { timeout: 180000, env: { PATH: process.env.PATH, IDENTITY_BACKUP_KEY_FILE: c.keyFile,
            IDENTITY_COMPOSE_PROJECT: c.project, IDENTITY_BACKUP_DIRECTORY: path.join(c.stateDirectory, 'archives') } });
        const file = JSON.parse(output).encryptedArchive;
        if (path.dirname(file) !== path.join(c.stateDirectory, 'archives')) throw new Error('INVALID_BACKUP_DESTINATION');
        return file;
      },
      resume: async () => {
        const previousStage = stage; stage = 'SOURCE_RESUME';
        await resume(plan, c); stage = previousStage;
      },
      disarm: () => {
        command('systemctl', ['stop', `${unit}.timer`]);
        // Healthy resume has completed; leave no stale plan for a later run.
        consumePlan(planFile, plan);
      },
      probe: () => {
        stage = 'PUBLIC_DISCOVERY';
        const discovery = JSON.parse(command('curl', ['--fail', '--silent', '--show-error', '--max-time', '20',
          '--proto', '=https', c.discoveryUrl]));
        if (discovery.issuer !== c.issuer || !discovery.code_challenge_methods_supported?.includes('S256')) throw new Error('DISCOVERY_MISMATCH');
      },
      upload: (archive) => { stage = 'REMOTE_UPLOAD'; return transport(c, 'upload', archive); },
    });
    stage = 'VERIFY_RECEIPT';
    const m = JSON.parse(fs.readFileSync(result.archive + '.json', 'utf8'));
    const completedAt = new Date().toISOString();
    const next = { ...previous, project: c.project, lastRun: { startedAt, completedAt, ok: true },
      lastSuccess: { completedAt, backupCreatedAt: m.createdAt, archive: result.archive,
        remoteCopyVerified: true, objects: result.receipt.objects } };
    if (!health(next, c).healthy) throw new Error('RECEIPT_INVALID');
    atomicJson(statusFile, next);
    return { ok: true, completedAt, remoteCopyVerified: true, automaticDeletion: false };
  } catch {
    atomicJson(statusFile, { ...previous, project: c.project,
      lastRun: { startedAt, completedAt: new Date().toISOString(), ok: false, code: `${stage}_FAILED` } });
    // Preserve last success; a failed alert must never mark the backup successful.
    await monitor(c, true);
    return { ok: false, code: `${stage}_FAILED` };
  }
}
async function main() {
  if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('LINUX_ROOT_SERVICE_REQUIRED');
  const [mode, file, expectedPlanHash] = process.argv.slice(2);
  if (!['run', 'resume', 'monitor', 'test-alert'].includes(mode) || !path.isAbsolute(file || '')) throw new Error('INVALID_ARGUMENTS');
  privateFile(file);
  if (fs.statSync(file).uid !== 0) throw new Error('ROOT_OWNED_CONFIG_REQUIRED');
  const c = validateConfig(JSON.parse(fs.readFileSync(file, 'utf8'))); privateDirectory(c.stateDirectory);
  let result;
  if (mode === 'resume') {
    const planFile = path.join(c.stateDirectory, 'resume-plan.json');
    if (!fs.existsSync(planFile)) return; // ExecStopPost after preflight failure has nothing to resume.
    privateFile(planFile);
    const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    // A delayed watchdog from a previous invocation must NEVER resume a newer job.
    if (expectedPlanHash && (!/^[a-f0-9]{64}$/.test(expectedPlanHash) || planFingerprint(plan) !== expectedPlanHash)) {
      throw new Error('STALE_WATCHDOG_PLAN_DENIED');
    }
    await resume(plan, c);
    // Remove only this consumed operational plan, never an archive or key.
    consumePlan(planFile, plan); result = { sourceResumed: true };
  } else result = mode === 'run' ? await run(c, file) : await monitor(c, true, mode === 'test-alert');
  console.log(JSON.stringify(result));
  if (result.ok === false || (mode === 'monitor' && !result.healthy) ||
    (mode === 'test-alert' && !result.alertAcceptedBySmtp)) process.exitCode = 1;
}
module.exports = { validateConfig, validatePlan, planFor, planFingerprint, consumePlan, performBackup, readEnv, health, atomicJson, monitor, transport };
if (require.main === module) main().catch(() => {
  console.error('IDENTITY_BACKUP_SERVICE_FAILED; private diagnostics withheld'); process.exitCode = 1;
});
