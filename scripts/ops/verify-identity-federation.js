const assert = require('node:assert/strict');
const { identity, origin, read, save } = require('./identity-development-client');
const { erp } = require('./identity-development-erp');
const { totp } = require('./verify-identity-local');
const { sync } = require('./sync-identity-development');
class IdentitySession {
  cookies = new Map();
  async request(url, method = 'GET', body) {
    const target = new URL(url, origin);
    if (target.origin !== origin) throw new Error('Protocol test refused a non-local identity destination');
    const headers = { Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '), Referer: origin + '/', Origin: origin };
    if (body) {
      headers['Content-Type'] = 'application/json';
      const csrf = [...this.cookies].find(([name]) => name.toLowerCase().includes('csrf'));
      if (csrf) headers['X-authentik-CSRF'] = decodeURIComponent(csrf[1]);
    }
    const response = await fetch(target, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    if (process.env.IDENTITY_TEST_DEBUG === 'true') console.log(JSON.stringify({ method, path: target.pathname, status: response.status, redirectPath: response.headers.get('location') ? new URL(response.headers.get('location'), origin).pathname : undefined }));
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], separator = pair.indexOf('=');
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  }
  async flow(url, state) {
    const target = new URL(url, origin);
    const slug = target.pathname.match(/^\/if\/flow\/([a-zA-Z0-9_-]+)\//)?.[1];
    if (!slug) throw new Error('Unexpected local identity flow URL');
    // The normal flow page issues the CSRF cookie needed after user login.
    // Anonymous password challenges alone do not prove authenticated CSRF works.
    await this.request(target);
    const executor = `/api/v3/flows/executor/${slug}/?query=${encodeURIComponent(target.search.slice(1))}`;
    let response = await this.request(executor);
    for (let step = 0; step < 15; step++) {
      if (response.status === 302) {
        const redirect = new URL(response.headers.get('location'), response.url);
        if (redirect.pathname.startsWith('/api/v3/flows/executor/')) {
          response = await this.request(redirect);
          continue;
        }
        return redirect.href;
      }
      assert.equal(response.status, 200, 'Identity flow challenge status');
      const challenge = await response.json();
      const component = challenge.component;
      if (process.env.IDENTITY_TEST_DEBUG === 'true') console.log(JSON.stringify({ component }));
      if (component === 'xak-flow-redirect') return challenge.to;
      let body;
      if (component === 'ak-stage-identification') body = { component, uid_field: state.email, password: read('development-secrets.json').fixturePassword };
      else if (component === 'ak-stage-password') body = { component, password: read('development-secrets.json').fixturePassword };
      else if (component === 'ak-stage-authenticator-validate' && state.totpSecret) {
        state.mfaChallengeObserved = true;
        if (state.testMissingMfa && !state.missingMfaResponseDenied) {
          let rejected = await this.request(executor, 'POST', { component });
          if (rejected.status === 302) rejected = await this.request(new URL(rejected.headers.get('location'), rejected.url));
          assert.equal(rejected.status, 200, 'Incomplete MFA remains a challenge');
          const retry = await rejected.json();
          assert.equal(retry.component, component, 'MFA cannot advance without an authenticator response');
          assert.ok(Object.keys(retry.response_errors || {}).length, 'Incomplete MFA must report a validation error');
          state.missingMfaResponseDenied = true;
        }
        const counter = Math.floor(Date.now() / 30000);
        if (state.lastTotpCounter >= counter) await new Promise(resolve => setTimeout(resolve, (state.lastTotpCounter + 1) * 30000 - Date.now() + 1000));
        body = { component, code: totp(state.totpSecret) };
      } else if (component === 'ak-stage-authenticator-totp' && challenge.config_url) {
        state.mfaEnrollmentObserved = true;
        state.totpSecret = new URL(challenge.config_url).searchParams.get('secret');
        save('authentik-fixture.json', state);
        body = { component, code: totp(state.totpSecret) };
      } else throw new Error(`Unsupported local challenge ${String(component).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}`);
      if (challenge.response_errors && Object.keys(challenge.response_errors).length) throw new Error('Identity flow rejected the synthetic response');
      response = await this.request(executor, 'POST', body);
      if (body.code && response.status < 400) {
        state.lastTotpCounter = Math.floor(Date.now() / 30000);
        save('authentik-fixture.json', state);
      }
    }
    throw new Error('Identity flow exceeded bounded test steps');
  }
}
async function signedLogin(state, session = new IdentitySession()) {
  const fixture = read('fixture.json');
  let next = await erp(`/sso/${fixture.schoolCode}/${state.slug}/start`, 'GET', undefined, undefined, 302);
  const authorization = new URL(next);
  assert.equal(authorization.origin, origin);
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(authorization.searchParams.get('nonce')?.length > 20);
  assert.ok(authorization.searchParams.get('state')?.length > 20);
  let callback;
  for (let redirect = 0; redirect < 15; redirect++) {
    const target = new URL(next, origin);
    if (target.origin === 'http://localhost:4100') { callback = target; break; }
    if (target.pathname.startsWith('/if/flow/')) next = await session.flow(target, state);
    else {
      const response = await session.request(target);
      assert.equal(response.status, 302, 'Local authorization redirect status');
      next = response.headers.get('location');
    }
  }
  assert.ok(callback && callback.pathname === '/api/v1/sso/oidc/callback', 'Exact signed callback required');
  const result = new URL(await erp('/sso/oidc/callback' + callback.search, 'GET', undefined, undefined, 302));
  assert.equal(result.origin, 'http://localhost:3100');
  const code = result.searchParams.get('code');
  assert.match(code, /^[A-Za-z0-9_-]{43}$/);
  const login = (await erp('/sso/exchange', 'POST', { code }, undefined, 201)).data;
  assert.equal(login.user.email, state.email);
  assert.equal(login.user.schoolId, fixture.schoolId);
  assert.equal(login.user.role, 'TEACHER');
  await erp('/sso/exchange', 'POST', { code }, undefined, 401);
  await erp('/sso/oidc/callback' + callback.search, 'GET', undefined, undefined, 401);
  return { session, login };
}
async function main() {
  const state = read('authentik-fixture.json');
  state.testMissingMfa = process.argv.includes('--negative-mfa');
  state.missingMfaResponseDenied = false;
  const list = await erp('/scim/v2/Users?filter=' + encodeURIComponent(`userName eq "${state.email}"`), 'GET', undefined, state.scimToken);
  assert.equal(list.totalResults, 1, 'Authentik worker must first provision exactly one synthetic teacher');
  const { login } = await signedLogin(state);
  if (state.mfaFlowId) assert.ok(state.mfaChallengeObserved || state.mfaEnrollmentObserved, 'Application MFA challenge required');
  const claims = JSON.parse(Buffer.from(login.accessToken.split('.')[1], 'base64url').toString());
  if (state.mfaFlowId) assert.ok(claims.amr?.includes('mfa'), 'ERP session must recognize verified provider MFA');
  let workerLifecycleVerified = false;
  if (process.argv.includes('--lifecycle')) {
    await erp('/auth/me', 'GET', undefined, login.accessToken);
    const waitFor = async predicate => {
      for (let attempt = 0; attempt < 25; attempt++) {
        const user = await erp(`/scim/v2/Users/${login.user.id}`, 'GET', undefined, state.scimToken);
        if (predicate(user)) return;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('Bounded synthetic worker sync verification timed out');
    };
    let deactivated = false;
    try {
      await identity(`/api/v3/core/users/${state.userId}/`, 'PATCH', { attributes: { erp_given_name: 'Synthetic Updated', erp_family_name: 'Identity Teacher' } });
      await sync();
      await waitFor(user => user.name.givenName === 'Synthetic Updated');
      await identity(`/api/v3/core/users/${state.userId}/`, 'PATCH', { is_active: false });
      deactivated = true;
      await sync();
      await waitFor(user => user.active === false);
      await erp('/auth/me', 'GET', undefined, login.accessToken, 401);
      workerLifecycleVerified = true;
    } finally {
      if (deactivated) {
        await identity(`/api/v3/core/users/${state.userId}/`, 'PATCH', { is_active: true });
        await sync();
        await waitFor(user => user.active === true);
      }
    }
  }
  const report = { verifiedAt: new Date().toISOString(), signedOidcVerified: true, pkceStateNonceRequired: true, exchangeReplayDenied: true, callbackReplayDenied: true, syntheticTeacherProvisionedByAuthentik: true, providerMfaChallengeObserved: Boolean(state.mfaChallengeObserved), providerMfaEnrollmentObserved: Boolean(state.mfaEnrollmentObserved), missingMfaResponseDenied: Boolean(state.missingMfaResponseDenied), erpRecognizesProviderMfa: claims.amr?.includes('mfa') === true, workerLifecycleVerified, erpUserId: login.user.id, realSchoolDataUsed: false, browserUiTested: false };
  save('federation-acceptance.json', report);
  console.log(JSON.stringify(report));
}
module.exports = { IdentitySession, signedLogin };
if (require.main === module) main().catch(error => { console.error(JSON.stringify({ error: error.code === 'ERR_ASSERTION' ? error.message : error.message?.replace(/https?:\/\/\S+/g, '[URL redacted]') })); process.exitCode = 1; });
