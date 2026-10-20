const { test } = require('node:test');
const assert = require('node:assert/strict');
const { review, httpsUrl } = require('./school-readiness');
const template = require('../../infrastructure/deploy/school-onboarding.example.json');
function fixture() {
  const c = structuredClone(template);
  c.school = { name: 'Synthetic Acceptance School', code: 'SYN-01',
    emailDomain: 'school.edu.in', administratorEmail: 'admin@school.edu.in' };
  c.deployment = { mode: 'on-premises', server: 'owned-school-server',
    approvedDataLocation: 'school premises', appOrigin: 'https://erp.school.edu.in',
    apiOrigin: 'https://api.school.edu.in', identityOrigin: 'https://id.school.edu.in',
    operator: 'named operator', documentStorage: 'local', backupDestination: 'approved second device',
    recoveryKeyCustodian: 'named custodian', alertOwner: 'named owner' };
  c.identity = { issuer: 'https://id.school.edu.in/application/o/erp/', clientId: 'school-client', samlRequired: false };
  return c;
}
test('blank manifest cannot claim a deployment or accepted school', () => {
  const result = review(template);
  assert.equal(result.configurationComplete, false);
  assert.equal(result.preparedRequests, null);
  assert.equal(result.goLiveApproved, false);
});
test('school requests start disabled and do not enforce SSO or JIT', () => {
  const result = review(fixture());
  assert.equal(result.configurationComplete, true);
  assert.equal(result.operatorAttestationsComplete, false);
  assert.equal(result.preparedRequests.provider.enabled, false);
  assert.equal(result.preparedRequests.provider.jitProvisioning, false);
  assert.equal(result.preparedRequests.provider.enforceSso, false);
  assert.equal(result.preparedRequests.callback, 'https://api.school.edu.in/api/v1/sso/oidc/callback');
});
test('development, wrong-school and undated evidence do not satisfy production gates', () => {
  for (const change of [{ environment: 'development' }, { schoolCode: 'OTHER' }, { verifiedAt: '' }]) {
    const config = fixture();
    config.acceptance.identityRestoreAndLogin = { passed: true, environment: 'production', schoolCode: 'SYN-01',
      operator: 'operator', reference: 'ticket', verifiedAt: '2026-01-01T00:00:00Z', ...change };
    assert.ok(review(config).missing.includes('acceptance.identityRestoreAndLogin'));
  }
});
test('cloud needs object storage and PITR, and federation stays on the approved HTTPS origin', () => {
  const config = fixture(); config.deployment.mode = 'cloud';
  assert.ok(review(config).missing.includes('deployment.documentStorage'));
  assert.ok(review(config).missing.includes('acceptance.providerPitr'));
  config.identity.issuer = 'https://unapproved.edu.in/';
  assert.ok(review(config).missing.includes('identity.issuer'));
  for (const value of ['http://school.edu.in', 'https://user:pass@school.edu.in', 'https://localhost', 'https://school.edu.in/?token=secret']) {
    assert.equal(httpsUrl(value), false);
  }
});
