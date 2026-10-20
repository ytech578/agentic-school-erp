const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

function runtimeEnvironment(source) {
  const result = {};
  const administrative = /^(?:NEON_DATABASE_URL|NEON_RUNTIME_DATABASE_URL|MIGRATION_DATABASE_URL|LOCAL_DATABASE_URL|BACKUP_.*|AUDIT_EXPORT_.*|DB_PASSWORD|DB_USER|DB_RUNTIME_PASSWORD|DEMO_PASSWORD|SEED_.*|AUTHENTIK_BOOTSTRAP_.*)$/;
  for (const [name, value] of Object.entries(source)) if (!administrative.test(name)) result[name] = value;
  const runtime = new URL(source.NEON_RUNTIME_DATABASE_URL || source.DATABASE_URL);
  for (const name of ['NEON_DATABASE_URL', 'MIGRATION_DATABASE_URL']) {
    if (source[name]) {
      const owner = new URL(source[name]);
      if (owner.hostname.replace('-pooler.', '.') === runtime.hostname.replace('-pooler.', '.') && owner.username === runtime.username) throw new Error('Refusing to export owner credentials as the application role');
    }
  }
  result.DATABASE_URL = runtime.href;
  result.DATABASE_RLS_ENABLED = 'true';
  result.APP_RUNTIME_ENV_ONLY = 'true';
  return result;
}

function main() {
  const dotenv = require('dotenv');
  const input = path.join(root, 'apps/api/.env');
  const output = path.join(root, 'apps/api/.env.runtime');
  const values = runtimeEnvironment(dotenv.parse(fs.readFileSync(input)));
  // Never overwrite a separately managed deployment file without an explicit flag.
  fs.writeFileSync(output, Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n', { flag: process.argv.includes('--refresh') ? 'w' : 'wx', mode: 0o600 });
  console.log(JSON.stringify({ runtimeEnvironmentCreated: true, administrativeCredentialsExcluded: true, file: output }));
}
module.exports = { runtimeEnvironment };
if (require.main === module) { try { main(); } catch { console.error('Runtime environment export failed. Check the selected role or existing output file; no secrets were logged.'); process.exitCode = 1; } }
