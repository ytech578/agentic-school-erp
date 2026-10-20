const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IdentitySession } = require('./verify-identity-federation');
test('protocol tester refuses remote identity destinations before sending cookies', async () => {
  const session = new IdentitySession();
  session.cookies.set('authentik_session', 'synthetic-test-cookie');
  await assert.rejects(session.request('https://remote.invalid/api/v3/'), /non-local/);
  await assert.rejects(session.request('http://localhost:9443/api/v3/'), /non-local/);
});
test('protocol tester preserves CSRF and rotated session cookies without disabling TLS', async () => {
  const original = global.fetch;
  let count = 0;
  global.fetch = async (_url, options) => {
    count++;
    if (count === 1) {
      const headers = new Headers();
      headers.append('Set-Cookie', 'authentik_csrf=synthetic-csrf; Path=/; Secure');
      headers.append('Set-Cookie', 'authentik_session=old; Path=/; Secure; HttpOnly');
      return new Response('{}', { headers });
    }
    assert.equal(options.headers['X-authentik-CSRF'], 'synthetic-csrf');
    assert.match(options.headers.Cookie, /authentik_session=old/);
    assert.equal(options.redirect, 'manual');
    return new Response('{}', { headers: { 'Set-Cookie': 'authentik_session=rotated; Path=/; Secure; HttpOnly' } });
  };
  try {
    const session = new IdentitySession();
    await session.request('/if/flow/test/');
    await session.request('/api/v3/flows/executor/test/', 'POST', { component: 'synthetic' });
    assert.equal(session.cookies.get('authentik_session'), 'rotated');
  } finally { global.fetch = original; }
});
