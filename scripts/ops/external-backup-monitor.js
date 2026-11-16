'use strict';
// Publish only two boolean health measurements. No keys, rows, URLs or archive
// inventories leave this process. Cloud Monitoring, not this VM, owns alerts.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { health: neonHealth, validateConfig: neonConfig } = require('../dr/scheduled-neon-backup');
const { health: identityHealth, validateConfig: identityConfig, atomicJson } = require('../dr/scheduled-identity-backup');
const metricType = 'custom.googleapis.com/school_erp/backup_health';
const metadataRoot = 'http://169.254.169.254/computeMetadata/v1/';
function validateConfig(c) {
  assert.deepEqual(Object.keys(c).sort(), ['projectId', 'instanceName', 'sourceProject', 'neonConfigPath', 'identityConfigPath', 'stateDirectory'].sort());
  assert.match(c.projectId, /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/);
  for (const k of ['instanceName', 'sourceProject']) assert.match(c[k], /^[a-z][a-z0-9-]{0,61}[a-z0-9]$/);
  assert.equal(c.neonConfigPath, '/etc/school-erp-neon-backup/config.json');
  assert.equal(c.identityConfigPath, '/etc/school-erp-backup/config.json');
  assert.equal(c.stateDirectory, '/var/lib/school-erp-monitoring');
  return c;
}
function privateJson(file) {
  const s = fs.lstatSync(file);
  assert(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size <= 65536);
  if (process.platform === 'linux') assert(s.uid === 0 && !(s.mode & 0o077));
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function evaluate(status, c, health, now = Date.now()) {
  // An expected bounded RUNNING job is not a failed backup. Preserve all age,
  // archive and remote-receipt checks against the preceding successful backup.
  const started = Date.parse(status.lastRun?.startedAt);
  const running = status.lastRun?.ok === false && status.lastRun?.code === 'RUNNING' &&
    Number.isFinite(started) && started <= now && now - started < 10 * 60000;
  return health(running ? { ...status, lastRun: { ...status.lastRun, ok: true } } : status, c, now);
}
function collect(c, now = Date.now(), read = privateJson, checks = { neon: neonHealth, identity: identityHealth }) {
  const signals = {};
  for (const workload of ['neon', 'identity']) {
    try {
      const source = (workload === 'neon' ? neonConfig : identityConfig)(read(c[workload + 'ConfigPath']));
      assert.equal(source.project, c.sourceProject);
      const expected = '/var/lib/school-erp-' + (workload === 'neon' ? 'neon' : 'identity') + '-backup';
      assert.equal(source.stateDirectory, expected);
      const result = evaluate(read(path.join(expected, 'status.json')), source, checks[workload], now);
      signals[workload] = result.healthy === true;
    } catch { signals[workload] = false; } // Missing/corrupt/foreign status fails closed.
  }
  return signals;
}
function timeSeries(c, signals, now = Date.now()) {
  assert.deepEqual(Object.keys(signals).sort(), ['identity', 'neon']);
  assert(Object.values(signals).every(v => typeof v === 'boolean'));
  return { timeSeries: ['neon', 'identity'].map(workload => ({
    metric: { type: metricType, labels: { workload, instance: c.instanceName } },
    resource: { type: 'global', labels: { project_id: c.projectId } },
    metricKind: 'GAUGE', valueType: 'INT64', unit: '1',
    points: [{ interval: { endTime: new Date(now).toISOString() }, value: { int64Value: signals[workload] ? '1' : '0' } }],
  })) };
}
async function request(url, options, fetcher = fetch) {
  return fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
}
async function publish(c, signals, now = Date.now(), fetcher = fetch) {
  async function metadata(suffix) {
    const r = await request(metadataRoot + suffix, { headers: { 'Metadata-Flavor': 'Google' } }, fetcher);
    assert(r.ok && r.headers.get('metadata-flavor') === 'Google', 'METADATA_IDENTITY_UNCONFIRMED');
    const text = await r.text(); assert(text.length <= 16384); return text;
  }
  assert.equal((await metadata('project/project-id')).trim(), c.projectId);
  const token = JSON.parse(await metadata('instance/service-accounts/default/token'));
  assert(typeof token.access_token === 'string' && token.access_token && Number(token.expires_in) > 0);
  try {
    const r = await request('https://monitoring.googleapis.com/v3/projects/' + c.projectId + '/timeSeries', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(timeSeries(c, signals, now)),
    }, fetcher);
    // Never log provider response bodies, headers, token contents or exceptions.
    if (!r.ok) throw new Error('MONITORING_WRITE_HTTP_' + r.status);
    await r.arrayBuffer();
    return { acceptedByCloudMonitoring: true };
  } finally { token.access_token = ''; }
}
async function main() {
  assert(process.platform === 'linux' && process.getuid() === 0);
  assert.deepEqual(process.argv.slice(2), ['/etc/school-erp-monitoring/config.json']);
  const c = validateConfig(privateJson(process.argv[2]));
  const dir = fs.lstatSync(c.stateDirectory);
  assert(dir.isDirectory() && !dir.isSymbolicLink() && dir.uid === 0 && !(dir.mode & 0o077));
  const now = Date.now(), signals = collect(c, now);
  await publish(c, signals, now);
  const report = { checkedAt: new Date(now).toISOString(), acceptedByCloudMonitoring: true,
    neonHealthy: signals.neon, identityHealthy: signals.identity, schoolDataTransmitted: false,
    backupCredentialsRead: false, recoveryKeysRead: false, backupSchedulesChanged: false };
  atomicJson(path.join(c.stateDirectory, 'status.json'), report);
  console.log(JSON.stringify(report));
}
module.exports = { metricType, metadataRoot, validateConfig, privateJson, evaluate, collect, timeSeries, publish };
if (require.main === module) main().catch(error => {
  const code = /^MONITORING_WRITE_HTTP_\d{3}$/.test(error.message) ? error.message : 'PUBLISH_NOT_ACCEPTED';
  console.error('EXTERNAL_MONITOR_' + code + '; private diagnostics withheld'); process.exitCode = 1;
});
