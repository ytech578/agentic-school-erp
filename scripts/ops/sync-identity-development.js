const { identity, read } = require('./identity-development-client');
function redact(value) {
  if (typeof value === 'string') return value.replace(/https?:[^\s"<>]+/g, '[URL]').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '[synthetic-email]').replace(/[A-Za-z0-9_-]{40,}/g, '[opaque]');
  return value;
}
async function sync() {
  const state = read('authentik-fixture.json');
  const model = read('authentik-schema.json').components.schemas.SyncObjectModelEnum.enum.find(value => value.endsWith('.User'));
  if (!model || !Number.isInteger(state.userId)) throw new Error('Synthetic user model required');
  return identity(`/api/v3/providers/scim/${state.scimId}/sync/object/`, 'POST', { sync_object_model: model, sync_object_id: String(state.userId) }, 200);
}
module.exports = { sync, redact };
if (require.main === module) sync().then(result => console.log(JSON.stringify(result, (key, value) => /token|secret|password/i.test(key) ? '[redacted]' : redact(value)))).catch(error => { console.error(error.message); process.exitCode = 1; });
