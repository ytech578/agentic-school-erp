// Administrative helper strictly restricted to the loopback synthetic IdP.
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../../backups/identity');
const origin = 'https://localhost:9443';
function read(name) { return JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')); }
function save(name, value) { fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2), { mode: 0o600 }); }
async function identity(route, method = 'GET', body, expected = method === 'POST' ? 201 : 200) {
  if (!route.startsWith('/api/v3/')) throw new Error('Only the local identity API is allowed');
  const url = new URL(route, origin);
  if (url.origin !== origin || !url.pathname.startsWith('/api/v3/')) throw new Error('Invalid local API path');
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${read('development-secrets.json').bootstrapToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (response.status !== expected) {
    const error = new Error(`Local identity ${method} ${url.pathname} returned ${response.status}`);
    try { error.fields = Object.keys(await response.json()); } catch { /* Never log raw responses. */ }
    throw error;
  }
  return response.status === 204 ? undefined : response.json();
}
module.exports = { directory, origin, read, save, identity };
if (require.main === module) identity('/api/v3/schema/?format=json').then(schema => {
  save('authentik-schema.json', schema);
  for (const name of ['OAuth2ProviderRequest', 'ApplicationRequest', 'UserRequest', 'SCIMProviderRequest', 'PolicyBindingRequest', 'SCIMMappingRequest']) {
    const entry = schema.components.schemas[name];
    console.log(JSON.stringify({ name, required: entry?.required, fields: entry ? Object.keys(entry.properties) : [] }));
  }
}).catch(error => { console.error(error.message); process.exitCode = 1; });
