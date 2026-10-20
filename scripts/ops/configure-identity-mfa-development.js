const { identity, read, save } = require('./identity-development-client');
async function main() {
  const state = read('authentik-fixture.json');
  const remember = (key, value) => { state[key] = value; save('authentik-fixture.json', state); };
  const stages = (await identity('/api/v3/stages/all/')).results;
  const stage = name => { const match = stages.find(value => value.name === name); if (!match) throw new Error('Expected built-in development stage missing'); return match.pk; };
  if (!state.passwordFlowId) {
    const flow = await identity('/api/v3/flows/instances/', 'POST', { name: state.slug + '-password', slug: state.slug + '-password', title: 'Synthetic school sign-in', designation: 'authentication', authentication: 'none' });
    remember('passwordFlowId', flow.pk);
  }
  const bindings = (await identity('/api/v3/flows/bindings/?target=' + state.passwordFlowId)).results;
  // Provider-specific authentication, with MFA BEFORE the login event is issued.
  for (const [name, order] of [['default-authentication-identification', 10], ['default-authentication-password', 20], ['default-authentication-login', 30]]) {
    const id = stage(name);
    if (!bindings.some(binding => binding.stage === id)) await identity('/api/v3/flows/bindings/', 'POST', { target: state.passwordFlowId, stage: id, order });
  }
  if (!state.mfaStageId) {
    const validation = await identity('/api/v3/stages/authenticator/validate/', 'POST', { name: state.slug + '-mandatory-mfa', not_configured_action: 'configure', device_classes: ['totp'], configuration_stages: [stage('default-authenticator-totp-setup')], last_auth_threshold: 'seconds=0' });
    remember('mfaStageId', validation.pk);
  }
  if (!state.mfaFlowId) {
    const flow = await identity('/api/v3/flows/instances/', 'POST', { name: state.slug + '-mfa', slug: state.slug + '-mfa', title: 'Verify your school authenticator', designation: 'authorization', authentication: 'require_authenticated' });
    remember('mfaFlowId', flow.pk);
  }
  const validationBindings = (await identity('/api/v3/flows/bindings/?target=' + state.mfaFlowId)).results;
  // Remove only bindings created in this synthetic flow during development.
  for (const binding of validationBindings) await identity(`/api/v3/flows/bindings/${binding.pk}/`, 'DELETE', undefined, 204);
  if (!bindings.some(binding => binding.stage === state.mfaStageId)) await identity('/api/v3/flows/bindings/', 'POST', { target: state.passwordFlowId, stage: state.mfaStageId, order: 25 });
  // A previous password-only IdP session must not bypass the application MFA.
  // Check the real login event used by this release to construct signed AMR.
  // Bind to the authorization FLOW, not the application: SCIM has no HTTP session.
  if (!state.mfaPolicyId) {
    const policy = await identity('/api/v3/policies/expression/', 'POST', { name: state.slug + '-verified-session-mfa', expression: 'from authentik.events.signals import get_login_event\nfrom authentik.stages.password.stage import PLAN_CONTEXT_METHOD_ARGS\nevent = get_login_event(request.http_request)\nreturn bool(event and event.context.get(PLAN_CONTEXT_METHOD_ARGS, {}).get("mfa_devices"))' });
    remember('mfaPolicyId', policy.pk);
  }
  if (!state.mfaPolicyBindingId) {
    const binding = await identity('/api/v3/policies/bindings/', 'POST', { target: state.mfaFlowId, policy: state.mfaPolicyId, order: 0, enabled: true, failure_result: false });
    remember('mfaPolicyBindingId', binding.pk);
  }
  await identity(`/api/v3/providers/oauth2/${state.oidcId}/`, 'PATCH', { authentication_flow: state.passwordFlowId, authorization_flow: state.mfaFlowId });
  console.log(JSON.stringify({ mandatoryMfaOnSyntheticApplication: true, protectsExistingPasswordOnlySessions: true, defaultAdminFlowChanged: false }));
}
main().catch(error => { console.error(JSON.stringify({ error: error.message, fields: error.fields })); process.exitCode = 1; });
