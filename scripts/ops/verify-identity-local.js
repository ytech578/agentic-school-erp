/** Destructive tests are restricted to our separately named, synthetic LOCAL fixture. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'backups/identity');

function fixtureUrl(source, fixture) {
  const url = new URL(source);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) ||
      !/^erp_identity_test_[a-f0-9]{10}$/.test(fixture.database)) {
    throw new Error('A validated synthetic local fixture is required');
  }
  url.pathname = '/' + fixture.database;
  return url;
}
function totp(secret, time = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret].map(character => {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid test authenticator secret');
    return index.toString(2).padStart(5, '0');
  }).join('');
  const key = Buffer.from((bits.match(/.{8}/g) || []).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const digest = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function main() {
  require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
  const fixture = JSON.parse(fs.readFileSync(path.join(directory, 'fixture.json'), 'utf8'));
  const secret = JSON.parse(fs.readFileSync(path.join(directory, 'development-secrets.json'), 'utf8'));
  const apiRequire = require('node:module').createRequire(path.join(root, 'apps/api/package.json'));
  const { PrismaClient } = apiRequire('@prisma/client');
  const database = new PrismaClient({ datasourceUrl: fixtureUrl(process.env.LOCAL_DATABASE_URL, fixture).href, log: [] });
  const base = 'http://localhost:4100/api/v1';
  const evidence = [];
  let tokenId, admin;
  async function request(route, method = 'GET', body, token, expected = 200) {
    const response = await fetch(base + route, { method, headers: {
      ...(body ? { 'Content-Type': route.startsWith('/scim/') ? 'application/scim+json' : 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    // Never include response bodies in assertions: they can contain tokens or PII.
    assert.equal(response.status, expected, `HTTP ${method} ${route.split('?')[0]} status`);
    return response.status === 204 ? null : response.json();
  }
  try {
    const login = await request('/auth/login', 'POST', { email: 'fixture-admin@erp-identity.invalid', password: secret.fixturePassword });
    admin = login.data.accessToken;
    assert.equal(login.data.user.schoolId, fixture.schoolId, 'Test API must use the isolated fixture');
    const health = await request('/health');
    assert.ok(health);
    evidence.push('isolated restricted-role API and administrator login');
    const token = (await request('/enterprise-identity/scim-tokens', 'POST', { schoolId: fixture.schoolId, name: 'Synthetic local acceptance', expiresAt: new Date(Date.now() + 3600000).toISOString() }, admin, 201)).data;
    tokenId = token.id;
    const email = `teacher-${crypto.randomBytes(5).toString('hex')}@erp-identity.invalid`;
    const userBody = { userName: email, externalId: crypto.randomUUID(), active: true, name: { givenName: 'Synthetic', familyName: 'Teacher' }, roles: [{ value: 'TEACHER' }] };
    const user = await request('/scim/v2/Users', 'POST', userBody, token.token, 201);
    assert.ok(user.id && user.schemas, 'SCIM response must be unwrapped');
    assert.equal(user.userName, email);
    const stored = await database.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(stored.schoolId, fixture.schoolId);
    const other = await database.user.create({ data: { schoolId: fixture.secondSchoolId, email: `other-${crypto.randomBytes(5).toString('hex')}@erp-identity.invalid`, firstName: 'Synthetic', lastName: 'Other School', role: 'TEACHER', status: 'ACTIVE', passwordHash: stored.passwordHash } });
    await request(`/scim/v2/Users/${other.id}`, 'GET', undefined, token.token, 404);
    await request('/enterprise-identity/scim-tokens', 'POST', { schoolId: fixture.secondSchoolId, name: 'Must be denied' }, admin, 400);
    evidence.push('SCIM create, protocol response, school scoping and cross-school denial');
    const updated = await request(`/scim/v2/Users/${user.id}`, 'PUT', { ...userBody, name: { givenName: 'Synthetic Updated', familyName: 'Teacher' } }, token.token);
    assert.equal(updated.name.givenName, 'Synthetic Updated');
    const listed = await request('/scim/v2/Users?filter=' + encodeURIComponent(`userName eq "${email}"`), 'GET', undefined, token.token);
    assert.equal(listed.totalResults, 1);
    assert.equal(listed.Resources[0].id, user.id);
    const escalation = await request('/scim/v2/Users', 'POST', { ...userBody, externalId: crypto.randomUUID(), userName: `escalation-${crypto.randomBytes(5).toString('hex')}@erp-identity.invalid`, roles: [{ value: 'SUPER_ADMIN' }] }, token.token, 201);
    assert.equal(escalation.roles[0].value, 'TEACHER', 'Unsupported roles cannot grant platform administration');
    evidence.push('SCIM full replacement, filtering and privileged-role escalation prevention');
    // Set a password ONLY on the uniquely created synthetic local user for MFA tests.
    await database.user.update({ where: { id: user.id }, data: { passwordHash: await apiRequire('bcryptjs').hash(secret.fixturePassword, 10) } });
    const passwordLogin = (await request('/auth/login', 'POST', { email, password: secret.fixturePassword })).data;
    const enrollment = (await request('/auth/mfa/setup', 'POST', { password: secret.fixturePassword }, passwordLogin.accessToken, 201)).data;
    const confirmed = (await request('/auth/mfa/verify', 'POST', { token: totp(enrollment.secret) }, passwordLogin.accessToken, 201)).data;
    assert.equal(confirmed.recoveryCodes.length, 10);
    await request('/auth/login', 'POST', { email, password: secret.fixturePassword }, undefined, 401);
    const recoveryLogin = (await request('/auth/login', 'POST', { email, password: secret.fixturePassword, otp: confirmed.recoveryCodes[0] })).data;
    await request('/auth/login', 'POST', { email, password: secret.fixturePassword, otp: confirmed.recoveryCodes[0] }, undefined, 401);
    evidence.push('real TOTP enrollment, missing-MFA denial, recovery login and recovery-code replay denial');
    const patch = active => ({ schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'replace', path: 'active', value: active }] });
    await request(`/scim/v2/Users/${user.id}`, 'PATCH', patch(false), token.token);
    await request('/auth/me', 'GET', undefined, recoveryLogin.accessToken, 401);
    await request('/auth/refresh', 'POST', { refreshToken: recoveryLogin.refreshToken }, undefined, 401);
    await request(`/scim/v2/Users/${user.id}`, 'PATCH', patch(true), token.token);
    assert.equal((await request(`/scim/v2/Users/${user.id}`, 'GET', undefined, token.token)).active, true);
    evidence.push('deactivation revokes access and refresh sessions; reactivation succeeds');
    await request(`/enterprise-identity/scim-tokens/${token.id}`, 'DELETE', undefined, admin);
    tokenId = null;
    await request('/scim/v2/Users', 'GET', undefined, token.token, 401);
    evidence.push('revoked provisioning token denied');
    const report = { verifiedAt: new Date().toISOString(), database: fixture.database, checks: evidence, realSchoolDataUsed: false, authentikFederationVerified: false };
    fs.writeFileSync(path.join(directory, 'local-acceptance.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(report));
  } finally {
    if (tokenId && admin) {
      try { await request(`/enterprise-identity/scim-tokens/${tokenId}`, 'DELETE', undefined, admin); }
      catch { console.error('Synthetic provisioning token cleanup needs an operator retry.'); }
    }
    await database.$disconnect();
  }
}
module.exports = { fixtureUrl, totp };
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ error: 'Isolated identity acceptance failed; no secrets logged', check: error.code === 'ERR_ASSERTION' ? error.message : 'Local test connectivity/configuration' }));
  process.exitCode = 1;
});
