const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtimeEnvironment } = require('./export-runtime-env');
test('runtime export excludes recovery/owner credentials while preserving application encryption', () => {
  const data = runtimeEnvironment({ DATABASE_URL: 'postgresql://runtime:pwd@db-pooler.neon.tech/erp', NEON_DATABASE_URL: 'postgresql://owner:pwd@db.neon.tech/erp', BACKUP_ENCRYPTION_KEY: 'private', PII_ENCRYPTION_KEY: 'needed', DEMO_PASSWORD: 'private', SMTP_HOST: 'mail' });
  assert.equal(data.NEON_DATABASE_URL, undefined); assert.equal(data.BACKUP_ENCRYPTION_KEY, undefined); assert.equal(data.DEMO_PASSWORD, undefined);
  assert.equal(data.PII_ENCRYPTION_KEY, 'needed'); assert.equal(data.APP_RUNTIME_ENV_ONLY, 'true');
});
test('owner credentials cannot be relabelled as the runtime role', () => {
  assert.throws(() => runtimeEnvironment({ DATABASE_URL: 'postgresql://owner:pwd@db-pooler.neon.tech/erp', MIGRATION_DATABASE_URL: 'postgresql://owner:pwd@db.neon.tech/erp' }));
});
