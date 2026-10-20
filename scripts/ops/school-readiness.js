/**
 * Offline operator review; never contacts an IdP, creates a school or enforces SSO.
 * Acceptance entries are operator attestations, not independently verified facts.
 */
const fs = require('node:fs');
const path = require('node:path');
const commonGates = [
  'serverCapacityAndLoad', 'trustedTlsAndRenewal', 'rlsRuntimeAndTenantIsolation',
  'privateDocumentsAndMalware', 'documentRetentionAndLegalHold',
  'independentEncryptedBackup', 'databaseAndDocumentRestore',
  'signedOidcAndReplayDenial', 'mfaAndRecovery', 'wrongSchoolAndDomainDenied',
  'jitDisabledAndUnassignedUserDenied', 'scimLifecycleAndSessionRevocation',
  'breakGlassDualControl', 'identityRestoreAndLogin', 'monitoringAndAlerts', 'schoolOwnerApproval',
];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
function validHost(value) {
  return typeof value === 'string' && value.length <= 253 &&
    value.split('.').length >= 2 && value.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) &&
    !/(?:^|\.)(?:localhost|invalid|example|test)$/i.test(value) &&
    !/^\d+(?:\.\d+){3}$/.test(value);
}
function httpsUrl(value, originOnly = true) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && validHost(url.hostname) && !url.username && !url.password &&
      !url.search && !url.hash && (!originOnly || url.pathname === '/');
  } catch { return false; }
}
function review(config) {
  const missing = [];
  const requireValue = (condition, field) => { if (!condition) missing.push(field); };
  const school = config.school || {}, deployment = config.deployment || {}, identity = config.identity || {};
  requireValue(nonempty(school.name), 'school.name');
  requireValue(/^[A-Za-z0-9_-]{2,30}$/.test(school.code || ''), 'school.code');
  requireValue(validHost(school.emailDomain), 'school.emailDomain');
  requireValue(typeof school.administratorEmail === 'string' &&
    /^[^@\s]+@[^@\s]+$/.test(school.administratorEmail) &&
    school.administratorEmail.split('@')[1].toLowerCase() === (school.emailDomain || '').toLowerCase(), 'school.administratorEmail');
  requireValue(['on-premises', 'cloud'].includes(deployment.mode), 'deployment.mode');
  for (const field of ['server', 'approvedDataLocation', 'operator', 'backupDestination', 'recoveryKeyCustodian', 'alertOwner']) {
    requireValue(nonempty(deployment[field]), `deployment.${field}`);
  }
  for (const field of ['appOrigin', 'apiOrigin', 'identityOrigin']) requireValue(httpsUrl(deployment[field]), `deployment.${field}`);
  requireValue(deployment.documentStorage === (deployment.mode === 'on-premises' ? 'local' : 's3'), 'deployment.documentStorage');
  requireValue(httpsUrl(identity.issuer, false) && httpsUrl(deployment.identityOrigin) &&
    new URL(identity.issuer).origin === new URL(deployment.identityOrigin).origin, 'identity.issuer');
  requireValue(nonempty(identity.clientId), 'identity.clientId');
  requireValue(typeof identity.samlRequired === 'boolean', 'identity.samlRequired');
  const gates = [...commonGates, ...(deployment.mode === 'cloud' ? ['providerPitr'] : []),
    ...(identity.samlRequired !== false ? ['samlSignedAssertion'] : [])];
  for (const gate of gates) {
    const evidence = config.acceptance?.[gate];
    requireValue(evidence?.passed === true && evidence?.environment === 'production' &&
      evidence?.schoolCode === school.code && nonempty(evidence?.operator) &&
      nonempty(evidence?.reference) && Number.isFinite(Date.parse(evidence?.verifiedAt)) &&
      Date.parse(evidence.verifiedAt) <= Date.now(), `acceptance.${gate}`);
  }
  const configurationComplete = missing.every((field) => field.startsWith('acceptance.'));
  return {
    configurationComplete, operatorAttestationsComplete: !missing.some((field) => field.startsWith('acceptance.')),
    missing, liveDeploymentPerformed: false, realSchoolCreated: false,
    evidenceIndependentlyVerified: false, goLiveApproved: false,
    preparedRequests: configurationComplete ? {
      school: { name: school.name.trim(), code: school.code, adminEmail: school.administratorEmail },
      provider: {
        name: `${school.name.trim()} Authentik`, slug: school.code.toLowerCase().replace(/_/g, '-'),
        type: 'OIDC', enabled: false, issuer: identity.issuer, clientId: identity.clientId,
        allowedDomains: [school.emailDomain.toLowerCase()], defaultRole: 'TEACHER',
        jitProvisioning: false, enforceSso: false,
      },
      callback: `${new URL(deployment.apiOrigin).origin}/api/v1/sso/oidc/callback`,
      scimEndpoint: `${new URL(deployment.apiOrigin).origin}/api/v1/scim/v2`,
    } : null,
  };
}
function main() {
  if (!process.argv[2]) throw new Error('Supply an operator onboarding JSON file');
  const report = review(JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8')));
  if (process.argv[3]) {
    // Explicit output and exclusive creation: never overwrite an accepted handoff.
    fs.writeFileSync(path.resolve(process.argv[3]), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  }
  console.log(JSON.stringify({ ...report, preparedRequests: report.preparedRequests ? 'Prepared privately in output file' : null }));
  if (report.missing.length) process.exitCode = 2;
}
module.exports = { review, httpsUrl };
if (require.main === module) {
  try { main(); } catch { console.error('School readiness input/output failed; no credentials were logged or records changed'); process.exitCode = 1; }
}
