const { identity, origin, read, save } = require('./identity-development-client');
const { erp, administrator } = require('./identity-development-erp');
async function main() {
  const fixture = read('fixture.json');
  const state = read('authentik-fixture.json');
  const remember = (key, value) => { state[key] = value; save('authentik-fixture.json', state); };
  const admin = await administrator();
  if (!state.erpProviderId) {
    const issuer = `${origin}/application/o/${state.slug}/`;
    const metadata = await fetch(issuer + '.well-known/openid-configuration', { signal: AbortSignal.timeout(30000) }).then(response => response.json());
    if (metadata.issuer !== issuer || !metadata.code_challenge_methods_supported?.includes('S256')) throw new Error('Strict issuer or PKCE discovery failed');
    const provider = (await erp('/enterprise-identity/providers', 'POST', { name: 'Local synthetic Authentik', slug: state.slug, type: 'OIDC', enabled: true, issuer, clientId: state.clientId, clientSecret: state.clientSecret, allowedDomains: ['erp-identity.invalid'], defaultRole: 'TEACHER', jitProvisioning: false, enforceSso: false }, admin)).data;
    remember('erpProviderId', provider.id);
  }
  if (!state.scimTokenId) {
    const token = (await erp('/enterprise-identity/scim-tokens', 'POST', { schoolId: fixture.schoolId, name: 'Local Authentik synthetic sync', expiresAt: new Date(Date.now() + 86400000).toISOString() }, admin)).data;
    remember('scimTokenId', token.id); remember('scimToken', token.token);
  }
  if (!state.scimId) {
    const provider = await identity('/api/v3/providers/scim/', 'POST', { name: state.slug + '-scim', url: 'http://host.docker.internal:4100/api/v1/scim/v2', auth_mode: 'token', token: state.scimToken, verify_certificates: true, property_mappings: [state.userMappingId], property_mappings_group: [state.groupMappingId], exclude_users_service_account: true, discovery_enabled: false });
    remember('scimId', provider.pk);
  }
  // User-only ERP: discovery also requests Groups BEFORE property mappings run.
  // Disable discovery, and retain the explicit SkipObject group mapping.
  await identity(`/api/v3/providers/scim/${state.scimId}/`, 'PATCH', { discovery_enabled: false });
  // Bind the application first; only then allow SCIM to synchronize its assigned users.
  const bindings = await identity(`/api/v3/policies/bindings/?target=${state.applicationId}`);
  if (!bindings.results.some(binding => binding.user === state.userId && binding.enabled)) throw new Error('Explicit school test-user binding required before SCIM activation');
  await identity(`/api/v3/core/applications/${state.slug}/`, 'PATCH', { backchannel_providers: [state.scimId] });
  console.log(JSON.stringify({ linkedOnlyToSyntheticErp: true, ssoEnforcedForRealUsers: false, scimUsersOnlyConfigured: true, federationVerified: false }));
}
main().catch(error => { console.error(JSON.stringify({ error: error.message, fields: error.fields })); process.exitCode = 1; });
