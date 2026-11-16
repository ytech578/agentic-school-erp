'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateConfig, evaluate, timeSeries, publish, metricType, metadataRoot } = require('./external-backup-monitor');
const c = require('../../infrastructure/monitoring/gcp/config.example.json');
const now = Date.parse('2026-11-14T18:00:00Z');
test('external monitor requires exact private source paths and bounded project/instance labels', () => {
  assert.equal(validateConfig(c), c);
  for (const change of [{ projectId: 'a/../../foreign' }, { instanceName: 'bad\nlabel' },
    { neonConfigPath: '/home/user/.env' }, { identityConfigPath: '/tmp/arbitrary' },
    { stateDirectory: '/' }, { extra: true }]) assert.throws(() => validateConfig({ ...c, ...change }));
});
test('cloud payload contains only two fixed-cardinality boolean measurements, not private source data', () => {
  const value = timeSeries(c, { neon: true, identity: false }, now);
  assert.equal(value.timeSeries.length, 2);
  for (const s of value.timeSeries) {
    assert.equal(s.metric.type, metricType); assert.equal(s.resource.type, 'global');
    assert.deepEqual(Object.keys(s.metric.labels).sort(), ['instance', 'workload']);
    assert.equal(s.points[0].interval.endTime, new Date(now).toISOString());
  }
  assert.equal(value.timeSeries[0].points[0].value.int64Value, '1');
  assert.equal(value.timeSeries[1].points[0].value.int64Value, '0');
  assert.throws(() => timeSeries(c, { neon: 'true', identity: false }, now));
  assert.throws(() => timeSeries(c, { neon: true, identity: true, secret: 'sensitive' }, now));
});
test('bounded in-progress backup still requires the previous archive and receipt health', () => {
  const health = (s) => ({ healthy: s.lastRun.ok === true && s.priorHealthy === true });
  const status = { lastRun: { ok: false, code: 'RUNNING', startedAt: new Date(now - 60000).toISOString() }, priorHealthy: true };
  assert.equal(evaluate(status, {}, health, now).healthy, true);
  assert.equal(status.lastRun.ok, false);
  for (const change of [{ priorHealthy: false }, { lastRun: { ...status.lastRun, startedAt: new Date(now - 11 * 60000).toISOString() } },
    { lastRun: { ...status.lastRun, startedAt: new Date(now + 60000).toISOString() } },
    { lastRun: { ...status.lastRun, code: 'DUMP_FAILED' } }])
    assert.equal(evaluate({ ...status, ...change }, {}, health, now).healthy, false);
});
function fakeFetch(calls, failure) {
  return async (url, options) => {
    calls.push({ url, options });
    const headers = new Headers({ 'Metadata-Flavor': 'Google' });
    if (url === metadataRoot + 'project/project-id') return new Response(c.projectId, { headers });
    if (url === metadataRoot + 'instance/service-accounts/default/token')
      return new Response(JSON.stringify({ access_token: 'synthetic-test-token', expires_in: 300 }), { headers });
    return new Response(failure ? 'private-provider-error-not-to-be-logged' : null, { status: failure || 200 });
  };
}
test('reporter uses existing metadata identity and verified fixed HTTPS API without exporting tokens', async () => {
  const calls = [];
  assert.deepEqual(await publish(c, { neon: true, identity: true }, now, fakeFetch(calls)), { acceptedByCloudMonitoring: true });
  assert.equal(calls.length, 3);
  assert(calls.every(x => x.options.redirect === 'error' && x.options.signal));
  assert.equal(calls[2].url, 'https://monitoring.googleapis.com/v3/projects/' + c.projectId + '/timeSeries');
  assert(!calls[2].options.body.includes('synthetic-test-token'));
});
test('wrong metadata identity refuses before acquiring a token or publishing', async () => {
  let count = 0;
  await assert.rejects(publish(c, { neon: true, identity: true }, now, async () => {
    count++; return new Response('different-project', { headers: { 'Metadata-Flavor': 'Google' } });
  }));
  assert.equal(count, 1);
});
test('permission or provider refusal is redacted and never reported as accepted', async () => {
  await assert.rejects(publish(c, { neon: true, identity: false }, now, fakeFetch([], 403)),
    error => error.message === 'MONITORING_WRITE_HTTP_403' && !error.message.includes('private-provider'));
});
test('external reporter cannot read source secrets, contact school database or control backup jobs', () => {
  const source = fs.readFileSync(__filename.replace('.test.js', '.js'), 'utf8');
  for (const text of ['readEnv(', 'loadArchive(', 'connectionEnv(', 'spawnSync(', 'systemctl', 'docker.sock']) assert(!source.includes(text));
  const unit = fs.readFileSync('infrastructure/monitoring/gcp/school-erp-external-monitor.service', 'utf8');
  assert(unit.includes('InaccessiblePaths=') && unit.includes('database.env') && unit.includes('recovery.key'));
  assert(unit.includes('MemoryMax=128M') && unit.includes('ProtectSystem=strict'));
});
