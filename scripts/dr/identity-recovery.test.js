const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canonicalDump, validateBundle, entry, decode, tarInventory } = require('./identity-recovery');
const { encryptArchive, decryptArchive } = require('./neon-backup');
const { randomBytes } = require('node:crypto');
function fixture() {
  return { version: 1, project: 'synthetic-school', secretKey: 's'.repeat(64),
    databaseImage: 'sha256:' + 'a'.repeat(64), identityImage: 'sha256:' + 'b'.repeat(64),
    databaseLogicalHash: 'c'.repeat(64), database: entry(Buffer.from('synthetic dump')),
    volumes: ['/data', '/templates', '/certs'].map((target) => ({ target, archive: entry(Buffer.alloc(1024)) })) };
}
test('entire identity bundle authenticates, including original secret and file inventory', () => {
  const bundle = fixture(), key = randomBytes(32);
  const encrypted = encryptArchive(Buffer.from(JSON.stringify(bundle)), key);
  assert.equal(encrypted.includes(Buffer.from(bundle.secretKey)), false);
  assert.deepEqual(validateBundle(JSON.parse(decryptArchive(encrypted, key))), bundle);
  assert.throws(() => decryptArchive(encrypted, randomBytes(32)));
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decryptArchive(encrypted, key));
});
test('recovery rejects missing volumes, duplicate targets and altered file contents', () => {
  const bundle = fixture();
  bundle.volumes[0].archive.base64 = Buffer.from('tampered').toString('base64');
  assert.throws(() => validateBundle(bundle), /integrity/);
  const duplicate = fixture(); duplicate.volumes[1].target = '/data';
  assert.throws(() => validateBundle(duplicate), /inventory/);
  const missing = fixture(); missing.volumes.pop();
  assert.throws(() => validateBundle(missing), /inventory/);
  const unexpected = fixture(); unexpected.volumes[0].target = '/etc';
  assert.throws(() => validateBundle(unexpected), /inventory/);
  assert.throws(() => decode({ base64: '!', sha256: 'bad' }));
});
test('logical dump comparison ignores only random pg_dump restrict markers', () => {
  assert.equal(canonicalDump(Buffer.from('\\restrict abc\nCOPY private data\n\\unrestrict abc\n')),
    canonicalDump(Buffer.from('\\restrict xyz\nCOPY private data\n\\unrestrict xyz\n')));
  assert.notEqual(canonicalDump(Buffer.from('COPY original')), canonicalDump(Buffer.from('COPY changed')));
});
function tarFile(name, content = 'private', type = '0') {
  const header = Buffer.alloc(512), data = Buffer.from(content);
  header.write(name, 0, 100);
  for (const [offset, width, number] of [[100, 8, 420], [108, 8, 0], [116, 8, 0], [124, 12, data.length], [136, 12, 10]]) {
    header.write(number.toString(8).padStart(width - 1, '0') + '\0', offset);
  }
  header.write('        ', 148); header.write(type, 156);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return Buffer.concat([header, data, Buffer.alloc((512 - data.length % 512) % 512)]);
}
test('volume verification ignores archive ordering but detects data and permission changes', () => {
  const end = Buffer.alloc(1024), first = tarFile('./one'), second = tarFile('./two');
  assert.deepEqual(tarInventory(Buffer.concat([first, second, end])), tarInventory(Buffer.concat([second, first, end])));
  assert.notDeepEqual(tarInventory(Buffer.concat([first, end])), tarInventory(Buffer.concat([tarFile('./one', 'changed'), end])));
  assert.throws(() => tarInventory(Buffer.concat([tarFile('../escape'), end])), /Unsafe/);
  assert.throws(() => tarInventory(Buffer.concat([tarFile('/absolute'), end])), /Unsafe/);
  assert.throws(() => tarInventory(Buffer.concat([first, first, end])), /duplicate/);
  assert.throws(() => tarInventory(Buffer.concat([tarFile('device', '', '3'), end])), /Unsupported/);
});
