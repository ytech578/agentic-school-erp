const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withNetworkRetry, resolveAddress, pgEnvironment } = require('./backup-network');

test('fresh work is retried for transient DNS errors with bounded backoff', async () => {
  const attempts = [], pauses = [];
  const result = await withNetworkRetry(async (attempt) => {
    attempts.push(attempt);
    if (attempt < 2) throw { diagnostic: 'could not translate host name' };
    return 'verified';
  }, { pause: async (ms) => { pauses.push(ms); } });
  assert.equal(result, 'verified'); assert.deepEqual(attempts, [0, 1, 2]); assert.deepEqual(pauses, [2000, 4000]);
});
test('authentication failures are not retried and retry exhaustion fails closed', async () => {
  let calls = 0;
  await assert.rejects(() => withNetworkRetry(async () => { calls++; throw new Error('password authentication failed'); }));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(() => withNetworkRetry(async () => { calls++; throw { code: 'EAI_AGAIN' }; }, { pause: async () => {} }));
  assert.equal(calls, 3);
});
test('resolved addresses rotate without changing hostname identity or weakening TLS', async () => {
  const lookup = async () => [{ address: '203.0.113.1' }, { address: '203.0.113.2' }];
  assert.equal(await resolveAddress('db.neon.tech', 1, lookup), '203.0.113.2');
  const env = pgEnvironment(new URL('postgresql://test:password@db.neon.tech/school_erp'), '203.0.113.2');
  assert.equal(env.PGHOST, 'db.neon.tech'); assert.equal(env.PGHOSTADDR, '203.0.113.2');
  assert.equal(env.PGSSLMODE, 'verify-full'); assert(env.PGSSLROOTCERT);
});
