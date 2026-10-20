const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixtureUrl, totp } = require('./verify-identity-local');
test('identity fixture refuses cloud connections and unowned database names', () => {
  const fixture = { database: 'erp_identity_test_0123456789' };
  assert.equal(fixtureUrl('postgresql://test:unused@localhost/old', fixture).pathname, '/' + fixture.database);
  assert.throws(() => fixtureUrl('postgresql://test:unused@remote.example/old', fixture));
  assert.throws(() => fixtureUrl('postgresql://test:unused@localhost/old', { database: 'school_erp' }));
});
test('test authenticator matches RFC 6238 SHA1 vectors truncated to six digits', () => {
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000), '287082');
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1111111109000), '081804');
  assert.throws(() => totp('bad secret'));
});
