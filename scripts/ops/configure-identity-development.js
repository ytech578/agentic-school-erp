/** Creates ONLY the synthetic school on the loopback development Authentik. */
const crypto = require('node:crypto');
const { identity, read, save } = require('./identity-development-client');
async function main() {
  const fixture = read('fixture.json');
  if (!/^erp_identity_test_[a-f0-9]{10}$/.test(fixture.database)) throw new Error('Invalid fixture');
  let state;
  try { state = read('authentik-fixture.json'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!state) {
    state = { slug: fixture.database.replaceAll('_', '-'), clientId: crypto.randomBytes(24).toString('hex'), clientSecret: crypto.randomBytes(40).toString('hex'), email: 'identity.teacher@erp-identity.invalid' };
    save('authentik-fixture.json', state);
  }
  const remember = (key, value) => { state[key] = value; save('authentik-fixture.json', state); };
  if (!state.userId) {
    const user = await identity('/api/v3/core/users/', 'POST', { username: state.email, email: state.email, name: 'Synthetic Identity Teacher', is_active: true, path: 'erp-synthetic', attributes: { erp_given_name: 'Synthetic', erp_family_name: 'Identity Teacher' } });
    remember('userId', user.pk);
    await identity(`/api/v3/core/users/${user.pk}/set_password/`, 'POST', { password: read('development-secrets.json').fixturePassword }, 204);
  }
  const flows = (await identity('/api/v3/flows/instances/')).results;
  const flow = slug => { const match = flows.find(value => value.slug === slug); if (!match) throw new Error('Expected installed flow missing'); return match.pk; };
  if (!state.oidcId) {
    const mappings = (await identity('/api/v3/propertymappings/provider/scope/')).results.filter(value => ['openid', 'email', 'profile'].includes(value.scope_name));
    if (mappings.length !== 3) throw new Error('Required OIDC scope mappings missing');
    const keys = (await identity('/api/v3/crypto/certificatekeypairs/')).results;
    const signingKey = keys.find(value => value.name === 'authentik Self-signed Certificate');
    if (!signingKey) throw new Error('Development signing key missing');
    const provider = await identity('/api/v3/providers/oauth2/', 'POST', { name: state.slug, authentication_flow: flow('default-authentication-flow'), authorization_flow: flow('default-provider-authorization-implicit-consent'), invalidation_flow: flow('default-provider-invalidation-flow'), client_type: 'confidential', grant_types: ['authorization_code'], client_id: state.clientId, client_secret: state.clientSecret, signing_key: signingKey.pk, property_mappings: mappings.map(value => value.pk), include_claims_in_id_token: true, redirect_uris: [{ matching_mode: 'strict', url: 'http://localhost:4100/api/v1/sso/oidc/callback' }] });
    remember('oidcId', provider.pk);
  }
  if (!state.applicationId) {
    const application = await identity('/api/v3/core/applications/', 'POST', { name: 'Synthetic school ERP acceptance only', slug: state.slug, provider: state.oidcId, policy_engine_mode: 'all' });
    remember('applicationId', application.pk);
  }
  if (!state.bindingId) {
    const binding = await identity('/api/v3/policies/bindings/', 'POST', { target: state.applicationId, user: state.userId, order: 0, enabled: true });
    remember('bindingId', binding.pk);
  }
  if (!state.userMappingId) {
    const mapping = await identity('/api/v3/propertymappings/provider/scim/', 'POST', { name: state.slug + '-users', expression: 'raise SkipObject' });
    remember('userMappingId', mapping.pk);
  }
  // request is present during compilation as well as evaluation in this release.
  // Do not depend on a user global first injected after the mapping was compiled.
  await identity(`/api/v3/propertymappings/provider/scim/${state.userMappingId}/`, 'PATCH', { expression: 'person = request.user\nreturn {"userName": person.email, "externalId": str(person.pk), "active": person.is_active, "name": {"givenName": person.attributes["erp_given_name"], "familyName": person.attributes["erp_family_name"]}, "emails": [{"value": person.email, "primary": True}], "roles": [{"value": "TEACHER"}]}' });
  if (!state.groupMappingId) {
    const mapping = await identity('/api/v3/propertymappings/provider/scim/', 'POST', { name: state.slug + '-skip-groups', expression: 'raise SkipObject' });
    remember('groupMappingId', mapping.pk);
  }
  console.log(JSON.stringify({ developmentApplicationConfigured: true, exactCallbackOnly: true, assignedSyntheticUsers: 1, realSchoolAccountsChanged: false, federationVerified: false }));
}
if (require.main === module) main().catch(error => { console.error(JSON.stringify({ error: error.message, fields: error.fields })); process.exitCode = 1; });
