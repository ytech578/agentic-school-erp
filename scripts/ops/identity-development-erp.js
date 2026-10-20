const assert = require('node:assert/strict');
const { read } = require('./identity-development-client');
async function erp(route, method = 'GET', body, token, expected = method === 'POST' ? 201 : 200) {
  if (!route.startsWith('/') || route.startsWith('//')) throw new Error('Invalid fixture API path');
  const url = new URL('/api/v1' + route, 'http://localhost:4100');
  if (!url.pathname.startsWith('/api/v1/')) throw new Error('Invalid fixture API path');
  const response = await fetch(url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': route.startsWith('/scim/') ? 'application/scim+json' : 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, expected, `Fixture ${method} ${route.split('?')[0]} status`);
  if (expected === 302) return response.headers.get('location');
  return expected === 204 ? undefined : response.json();
}
async function administrator() {
  const fixture = read('fixture.json');
  if (!/^erp_identity_test_[a-f0-9]{10}$/.test(fixture.database)) throw new Error('Invalid fixture');
  const login = (await erp('/auth/login', 'POST', { email: 'fixture-admin@erp-identity.invalid', password: read('development-secrets.json').fixturePassword }, undefined, 200)).data;
  assert.equal(login.user.schoolId, fixture.schoolId, 'Only synthetic fixture administrators allowed');
  return login.accessToken;
}
module.exports = { erp, administrator };
