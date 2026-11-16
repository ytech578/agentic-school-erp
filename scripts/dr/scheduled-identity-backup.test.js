const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { validateConfig, validatePlan, planFor, planFingerprint, consumePlan, performBackup, readEnv, health, atomicJson } = require('./scheduled-identity-backup');
const { prepareObjects, uploadObjects, sendAlert, smtpOptions } = require('./identity-backup-transport');
const { backupManifest, entry } = require('./identity-recovery');
const { encryptArchive } = require('./neon-backup');
const { requireDifferentHost } = require('./second-host-identity-drill');
const { installRootFile } = require('./install-identity-backup-service');
function configuration() {
  return { project: 'synthetic-school', stateDirectory: '/var/lib/erp-test', keyFile: '/private/recovery.key',
    storageEnvFile: '/private/storage.env', alertEnvFile: '/private/alerts.env', dependencyImage: 'sha256:' + 'a'.repeat(64),
    issuer: 'https://identity.example.test/application/o/pilot/',
    discoveryUrl: 'https://identity.example.test/application/o/pilot/.well-known/openid-configuration' };
}
function fixture() {
  const bundle = { version: 1, createdAt: new Date().toISOString(), project: 'synthetic-school', secretKey: 's'.repeat(64),
    databaseImage: 'sha256:' + 'a'.repeat(64), identityImage: 'sha256:' + 'b'.repeat(64),
    databaseLogicalHash: 'c'.repeat(64), database: entry(Buffer.from('synthetic dump')),
    volumes: ['/data', '/templates', '/certs'].map((target) => ({ target, archive: entry(Buffer.alloc(1024)) })) };
  const archive = encryptArchive(Buffer.from(JSON.stringify(bundle)), crypto.randomBytes(32));
  const name = 'identity-1794389700000-1234abcd.enc';
  const manifest = Buffer.from(JSON.stringify(backupManifest(bundle, archive, name)));
  return { archive, manifest, name, objects: prepareObjects(archive, manifest, bundle.project, name) };
}
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-schedule-test-'));
  t.after(() => {
    // All fixtures are known, test-owned immediate files (no recursive deletion).
    for (const name of fs.readdirSync(directory)) {
      const item = path.join(directory, name);
      if (fs.statSync(item).isDirectory()) {
        fs.readdirSync(item).forEach((child) => fs.unlinkSync(path.join(item, child))); fs.rmdirSync(item);
      } else fs.unlinkSync(item);
    }
    fs.rmdirSync(directory);
  });
  return directory;
}
test('schedule configuration requires exact fields, immutable image, verified HTTPS issuer and private absolute paths', () => {
  assert.deepEqual(validateConfig(configuration()), configuration());
  for (const change of [{ dependencyImage: 'latest' }, { keyFile: '../secret' }, { storageEnvFile: '/a,b' },
    { issuer: 'http://identity.test/' }, { discoveryUrl: 'https://elsewhere.test/metadata' },
    { ownerDatabaseUrl: 'postgresql://do-not-accept' }, { stateDirectory: '/' }]) {
    assert.throws(() => validateConfig({ ...configuration(), ...change }));
  }
});
test('source plan refuses intentionally stopped or unhealthy services and rejects arbitrary identities', () => {
  const source = Object.fromEntries(['server', 'worker'].map((name, i) => [name,
    { Id: String(i + 1).repeat(64), State: { Running: true, Health: { Status: 'healthy' } } }]));
  const plan = planFor(configuration(), source);
  assert.doesNotThrow(() => validatePlan(plan, configuration()));
  source.worker.State.Running = false; assert.throws(() => planFor(configuration(), source));
  assert.throws(() => validatePlan({ ...plan, project: 'different-project' }, configuration()));
  assert.throws(() => validatePlan({ ...plan, containers: [plan.containers[0], plan.containers[0]] }, configuration()));
  assert.throws(() => validatePlan({ ...plan, containers: [{ id: 'school_erp_api', service: 'server' }, plan.containers[1]] }, configuration()));
});
function operations(failure) {
  const calls = [];
  const ops = Object.fromEntries(['arm', 'stop', 'backup', 'resume', 'disarm', 'probe', 'upload'].map((name) => [name, async () => {
    calls.push(name); if (name === failure) throw new Error('synthetic failure');
    return name === 'upload' ? { remoteCopyVerified: true } : name === 'backup' ? '/private/encrypted.enc' : undefined;
  }]));
  return { ops, calls };
}
test('scheduler arms recovery before stopping, resumes before networking, accepts only verified remote copy', async () => {
  const { ops, calls } = operations();
  assert.equal((await performBackup(ops)).receipt.remoteCopyVerified, true);
  assert.deepEqual(calls, ['arm', 'stop', 'backup', 'resume', 'disarm', 'probe', 'upload']);
  const unverified = operations(); unverified.ops.upload = async () => ({ remoteCopyVerified: false });
  await assert.rejects(performBackup(unverified.ops), /UNVERIFIED/);
});
test('failed watchdog registration never pauses sign-in', async () => {
  const { ops, calls } = operations('arm'); await assert.rejects(performBackup(ops));
  assert.deepEqual(calls, ['arm']);
});
for (const failure of ['stop', 'backup']) test(`${failure} failure still resumes both original services and disarms watchdog`, async () => {
  const { ops, calls } = operations(failure); await assert.rejects(performBackup(ops));
  assert.deepEqual(calls.slice(-2), ['resume', 'disarm']); assert.equal(calls.includes('upload'), false);
});
test('failed source resume leaves independent watchdog armed and never uploads', async () => {
  const { ops, calls } = operations('resume'); await assert.rejects(performBackup(ops));
  assert.equal(calls.includes('disarm'), false); assert.equal(calls.includes('upload'), false);
});
test('network or R2 failure occurs after source resume, never marks backup successful', async () => {
  for (const failure of ['probe', 'upload']) {
    const { ops, calls } = operations(failure); await assert.rejects(performBackup(ops));
    assert.ok(calls.indexOf('resume') < calls.indexOf(failure));
  }
});
test('transport accepts only encrypted archive and non-secret strict manifest for exact project', () => {
  const f = fixture(); assert.equal(f.objects.length, 2);
  assert.ok(f.objects.every((o) => o.key.startsWith('identity-backups/synthetic-school/')));
  assert.throws(() => prepareObjects(f.archive, f.manifest, 'different-school', f.name));
  assert.throws(() => prepareObjects(f.archive, f.manifest, 'synthetic-school', '../' + f.name));
  const m = JSON.parse(f.manifest); m.recoveryKey = 'never upload this';
  assert.throws(() => prepareObjects(f.archive, Buffer.from(JSON.stringify(m)), 'synthetic-school', f.name));
  const tampered = Buffer.from(f.archive); tampered[tampered.length - 1] ^= 1;
  assert.throws(() => prepareObjects(tampered, f.manifest, 'synthetic-school', f.name));
});
function storeFixture({ interrupted = false, corrupted = false } = {}) {
  const items = new Map(), puts = [];
  return { items, puts, store: {
    get: async (key) => {
      if (!items.has(key)) throw Object.assign(new Error('not found'), { name: 'NoSuchKey' });
      return { Body: Readable.from([corrupted ? Buffer.from('bad') : items.get(key)]) };
    },
    put: async (o) => { assert.equal(items.has(o.key), false); puts.push(o.key); items.set(o.key, o.body);
      if (interrupted) throw new Error('write response lost'); },
  } };
}
test('R2 success requires downloading both objects; identical retry does not write again', async () => {
  const f = fixture(), s = storeFixture();
  const receipt = await uploadObjects(f.objects, s.store);
  assert.equal(receipt.remoteCopyVerified, true); assert.equal(receipt.recoveryKeyUploaded, false);
  assert.equal(s.puts.length, 2); await uploadObjects(f.objects, s.store); assert.equal(s.puts.length, 2);
});
test('unknown R2 write outcome is reconciled by exact download, not a destructive overwrite', async () => {
  const s = storeFixture({ interrupted: true });
  assert.equal((await uploadObjects(fixture().objects, s.store)).remoteCopyVerified, true);
  assert.equal(s.puts.length, 2);
});
test('R2 checksum mismatch or access denial fails closed without overwriting', async () => {
  const f = fixture(), s = storeFixture({ corrupted: true });
  s.items.set(f.objects[0].key, f.archive);
  await assert.rejects(uploadObjects(f.objects, s.store)); assert.equal(s.puts.length, 0);
  await assert.rejects(uploadObjects(f.objects, { get: async () => { throw new Error('access denied'); }, put: () => assert.fail() }));
});
test('private env parsing allowlists sender/storage fields and does not expand shell or app secrets', t => {
  const file = path.join(temporary(t), 'private.env');
  fs.writeFileSync(file, 'S3_ACCESS_KEY_ID="$(not executed)"\nDATABASE_URL=must-not-escape\nS3_REGION=auto\n', { mode: 0o600 });
  assert.deepEqual(readEnv(file, ['S3_ACCESS_KEY_ID', 'S3_REGION']), { S3_ACCESS_KEY_ID: '$(not executed)', S3_REGION: 'auto' });
  fs.writeFileSync(file, 'S3_REGION=auto\nS3_REGION=duplicate');
  assert.throws(() => readEnv(file, ['S3_REGION']), /DUPLICATED/);
});
function smtpEnv() {
  return { SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'sender@example.test', BACKUP_ALERT_EMAIL: 'operator@example.test',
    SMTP_USER: 'sender', SMTP_PASSWORD: 'synthetic-app-password' };
}
test('SMTP requires TLS, certificate checking, bounded timeouts and one simple recipient', () => {
  const settings = smtpOptions(smtpEnv());
  assert.equal(settings.requireTLS, true); assert.equal(settings.tls.rejectUnauthorized, true);
  assert.equal(settings.secure, false);
  assert.equal(smtpOptions({ ...smtpEnv(), SMTP_PORT: '465' }).secure, true);
  assert.throws(() => smtpOptions({ ...smtpEnv(), SMTP_PORT: '25' }));
  assert.throws(() => smtpOptions({ ...smtpEnv(), BACKUP_ALERT_EMAIL: 'a@test.in\r\nBcc: b@test.in' }));
});
test('alert includes only safe failure codes, confirms SMTP acceptance not inbox delivery', async () => {
  let closed = false;
  const receipt = await sendAlert({ project: 'synthetic-school', codes: ['BACKUP_STALE'] }, smtpEnv(), () => ({
    sendMail: async (mail) => {
      assert.ok(mail.text.includes('BACKUP_STALE')); assert.equal(JSON.stringify(mail).includes('synthetic-app-password'), false);
      return { accepted: ['operator@example.test'], rejected: [] };
    }, close: () => { closed = true; },
  }));
  assert.deepEqual(receipt, { acceptedBySmtp: true, inboxDeliveryVerified: false }); assert.equal(closed, true);
  await assert.rejects(sendAlert({ project: 'synthetic-school', codes: ['private\nrecords'] }, smtpEnv(), () => assert.fail()));
});
test('SMTP rejection remains a failure and closes sender connection', async () => {
  let closed = false;
  await assert.rejects(sendAlert({ project: 'synthetic-school', codes: ['TEST_ALERT_ONLY'] }, smtpEnv(), () => ({
    sendMail: async () => ({ accepted: [], rejected: ['operator@example.test'] }), close: () => { closed = true; },
  })));
  assert.equal(closed, true);
});
test('monitor detects absent, stale, future-dated, failed-run, corrupt-archive and forged remote receipt', t => {
  const directory = temporary(t), c = { ...configuration(), stateDirectory: directory };
  const archives = path.join(directory, 'archives'); fs.mkdirSync(archives);
  const f = fixture(), archive = path.join(archives, f.name);
  fs.writeFileSync(archive, f.archive, { mode: 0o600 }); fs.writeFileSync(archive + '.json', f.manifest, { mode: 0o600 });
  const status = { project: c.project, lastRun: { ok: true }, lastSuccess: { completedAt: new Date().toISOString(),
    backupCreatedAt: JSON.parse(f.manifest).createdAt, archive, remoteCopyVerified: true,
    objects: f.objects.map(({ key, bytes, sha256 }) => ({ key, bytes, sha256, downloadedAndVerified: true })) } };
  assert.equal(health(status, c).healthy, true); assert.equal(health({}, c).healthy, false);
  assert.ok(health({ ...status, lastRun: { ok: false } }, c).codes.includes('LATEST_RUN_NOT_SUCCESSFUL'));
  assert.ok(health(status, c, Date.now() + 27 * 3600000).codes.includes('BACKUP_MISSING_OR_STALE'));
  assert.ok(health(status, c, Date.now() - 3600000).codes.includes('BACKUP_MISSING_OR_STALE'));
  const forged = structuredClone(status); forged.lastSuccess.objects[0].sha256 = 'f'.repeat(64);
  assert.equal(health(forged, c).healthy, false);
  fs.writeFileSync(archive, Buffer.from('tampered')); assert.equal(health(status, c).healthy, false);
});
test('atomic status updates retain previous last success on failed run and leave no temporary file', t => {
  const directory = temporary(t), file = path.join(directory, 'status.json');
  const lastSuccess = { completedAt: new Date().toISOString() };
  atomicJson(file, { lastSuccess, lastRun: { ok: true } });
  atomicJson(file, { ...JSON.parse(fs.readFileSync(file)), lastRun: { ok: false } });
  assert.deepEqual(JSON.parse(fs.readFileSync(file)).lastSuccess, lastSuccess);
  assert.deepEqual(fs.readdirSync(directory), ['status.json']);
});
test('resume plans are invocation-bound, tolerate prior consumption and never remove a newer plan', t => {
  const file = path.join(temporary(t), 'resume-plan.json');
  const original = { project: 'synthetic-school', createdAt: '2026-11-11T10:00:00Z', containers: [] };
  const newer = { ...original, createdAt: '2026-11-12T10:00:00Z' };
  assert.notEqual(planFingerprint(original), planFingerprint(newer));
  atomicJson(file, newer);
  assert.throws(() => consumePlan(file, original), /CHANGED/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), newer);
  assert.equal(consumePlan(file, newer), true);
  assert.equal(consumePlan(file, newer), false);
});
test('second-host guard rejects another container on same machine or remote source Docker daemon', () => {
  const source = { version: 1, sourceProject: 'synthetic-school', machineFingerprint: 'a'.repeat(64), daemonFingerprint: 'b'.repeat(64) };
  const target = { machineFingerprint: 'c'.repeat(64), daemonFingerprint: 'd'.repeat(64) };
  assert.equal(requireDifferentHost(source, target, source.sourceProject), true);
  assert.throws(() => requireDifferentHost(source, { ...target, machineFingerprint: source.machineFingerprint }, source.sourceProject));
  assert.throws(() => requireDifferentHost(source, { ...target, daemonFingerprint: source.daemonFingerprint }, source.sourceProject));
  assert.throws(() => requireDifferentHost(source, target, 'different-school'));
});
test('systemd schedule is 03:00 India time, does not catch up pauses, and separately monitors missed runs', () => {
  const root = path.join(__dirname, '../../infrastructure/backups/identity');
  const timer = fs.readFileSync(path.join(root, 'school-erp-identity-backup.timer'), 'utf8');
  assert.ok(timer.includes('OnCalendar=*-*-* 03:00:00 Asia/Kolkata'));
  assert.ok(timer.includes('Persistent=false'));
  const service = fs.readFileSync(path.join(root, 'school-erp-identity-backup.service'), 'utf8');
  assert.ok(service.includes('flock --nonblock')); assert.ok(service.includes('OnFailure=school-erp-identity-backup-monitor.service'));
  const monitor = fs.readFileSync(path.join(root, 'school-erp-identity-backup-monitor.timer'), 'utf8');
  assert.ok(monitor.includes('OnCalendar=hourly')); assert.ok(monitor.includes('Persistent=true'));
});
test('installer explicitly changes copied binaries, code, units and private env to root ownership', () => {
  for (const mode of [0o755, 0o644, 0o600]) {
    const calls = [];
    const io = Object.fromEntries(['copyFileSync', 'chownSync', 'chmodSync'].map((method) => [method,
      (...args) => calls.push({ method, args })]));
    installRootFile('/reviewed/source', '/root-owned/target', mode, io);
    assert.deepEqual(calls, [
      { method: 'copyFileSync', args: ['/reviewed/source', '/root-owned/target', fs.constants.COPYFILE_EXCL] },
      { method: 'chownSync', args: ['/root-owned/target', 0, 0] },
      { method: 'chmodSync', args: ['/root-owned/target', mode] },
    ]);
  }
});
