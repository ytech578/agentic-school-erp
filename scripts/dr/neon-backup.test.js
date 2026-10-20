const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { encryptArchive, decryptArchive } = require('./neon-backup');
test('encrypted database archives round-trip without storing plaintext', () => {
  const key = randomBytes(32), plain = Buffer.from('private ERP backup');
  const encrypted = encryptArchive(plain, key);
  assert.equal(encrypted.includes(plain), false);
  assert.deepEqual(decryptArchive(encrypted, key), plain);
});
test('modified archives and incorrect keys are rejected', () => {
  const key = randomBytes(32), encrypted = encryptArchive(Buffer.from('backup'), key);
  assert.throws(() => decryptArchive(encrypted, randomBytes(32)));
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decryptArchive(encrypted, key));
});
