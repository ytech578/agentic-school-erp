const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canonicalDump, validateBundle, entry, decode, tarInventory, backupManifest, verifyManifest, loadRecoveryArchive } = require('./identity-recovery');
const { encryptArchive, decryptArchive } = require('./neon-backup');
const { randomBytes } = require('node:crypto');
function fixture() {
  return { version: 1, createdAt: '2026-11-11T09:35:00Z', project: 'synthetic-school', secretKey: 's'.repeat(64),
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
test('identity transport manifest contains no original key, database dump or credential material', () => {
  const bundle = fixture(), key = randomBytes(32);
  const encrypted = encryptArchive(Buffer.from(JSON.stringify(bundle)), key);
  const name = 'identity-1794389700000-1234abcd.enc';
  const manifest = backupManifest(bundle, encrypted, name);
  assert.doesNotThrow(() => verifyManifest(manifest, bundle, encrypted, name));
  assert.equal(manifest.independentCopyVerified, false);
  assert.equal(JSON.stringify(manifest).includes(bundle.secretKey), false);
  assert.equal(Object.hasOwn(manifest, 'database'), false);
  assert.equal(Object.hasOwn(manifest, 'secretKey'), false);
  assert.equal(Object.hasOwn(manifest, 'key'), false);
  assert.equal(manifest.archive.bytes, encrypted.length);
});
test('identity manifest rejects different encrypted bytes, source metadata and archive names', () => {
  const bundle = fixture(), key = randomBytes(32);
  const encrypted = encryptArchive(Buffer.from(JSON.stringify(bundle)), key);
  const name = 'identity-1794389700000-1234abcd.enc';
  const manifest = backupManifest(bundle, encrypted, name);
  const tampered = Buffer.from(encrypted); tampered[tampered.length - 1] ^= 1;
  assert.throws(() => verifyManifest(manifest, bundle, tampered, name));
  assert.throws(() => verifyManifest({ ...manifest, sourceProject: 'another-school' }, bundle, encrypted, name));
  assert.throws(() => verifyManifest({ ...manifest, volumeTargets: ['/data'] }, bundle, encrypted, name));
  assert.throws(() => backupManifest(bundle, encrypted, '../identity-1794389700000-1234abcd.enc'));
  // A forged transport claim must not promote the independent-copy result.
  assert.doesNotThrow(() => verifyManifest({ ...manifest, independentCopyVerified: true }, bundle, encrypted, name));
  assert.equal(backupManifest(bundle, encrypted, name).independentCopyVerified, false);
});
test('shared archive loader authenticates the manifest and key before returning a restore bundle', t => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-identity-loader-'));
  const keyFile = path.join(directory, 'synthetic.key');
  const archive = path.join(directory, 'identity-1794389700000-1234abcd.enc');
  t.after(() => {
    for (const file of [keyFile, archive, archive + '.json']) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(directory);
  });
  const bundle = fixture(), key = randomBytes(32);
  const encrypted = encryptArchive(Buffer.from(JSON.stringify(bundle)), key);
  fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(archive, encrypted, { mode: 0o600, flag: 'wx' });
  const manifest = backupManifest(bundle, encrypted, path.basename(archive));
  fs.writeFileSync(archive + '.json', JSON.stringify(manifest), { mode: 0o600, flag: 'wx' });
  const loaded = loadRecoveryArchive(archive, keyFile);
  assert.deepEqual(loaded.bundle, bundle);
  assert.equal(loaded.manifestPresent, true);
  fs.writeFileSync(archive + '.json', JSON.stringify({ ...manifest, sourceProject: 'wrong-school' }));
  assert.throws(() => loadRecoveryArchive(archive, keyFile), /metadata mismatch/);
});

test('verification works from an immutable release without creating a default backup directory', t => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const { spawnSync } = require('node:child_process');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-readonly-release-'));
  const release = path.join(directory, 'release'), scripts = path.join(release, 'scripts'), dr = path.join(scripts, 'dr');
  fs.mkdirSync(dr, { recursive: true });
  const names = ['identity-recovery.js', 'neon-backup.js', 'backup-network.js'];
  const keyFile = path.join(directory, 'synthetic.key');
  const archive = path.join(directory, 'identity-1794389700000-1234abcd.enc');
  t.after(() => {
    for (const dir of [release, scripts, dr]) fs.chmodSync(dir, 0o755);
    for (const name of names) { fs.chmodSync(path.join(dr, name), 0o644); fs.unlinkSync(path.join(dr, name)); }
    for (const file of [keyFile, archive, archive + '.json']) if (fs.existsSync(file)) fs.unlinkSync(file);
    // Explicit, empty, test-owned directories only; never recursive deletion.
    fs.rmdirSync(dr); fs.rmdirSync(scripts); fs.rmdirSync(release); fs.rmdirSync(directory);
  });
  for (const name of names) { fs.copyFileSync(path.join(__dirname, name), path.join(dr, name)); fs.chmodSync(path.join(dr, name), 0o444); }
  const bundle = fixture(), key = randomBytes(32);
  const encrypted = encryptArchive(Buffer.from(JSON.stringify(bundle)), key);
  fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 }); fs.writeFileSync(archive, encrypted, { mode: 0o600 });
  fs.writeFileSync(archive + '.json', JSON.stringify(backupManifest(bundle, encrypted, path.basename(archive))), { mode: 0o600 });
  for (const dir of [dr, scripts, release]) fs.chmodSync(dir, 0o555);
  const result = spawnSync(process.execPath, [path.join(dr, 'identity-recovery.js'), 'verify', archive],
    { encoding: 'utf8', timeout: 15000, env: { ...process.env, IDENTITY_BACKUP_KEY_FILE: keyFile } });
  assert.equal(result.status, 0, 'verification must not require a writable installation');
  assert.equal(JSON.parse(result.stdout).authenticated, true);
  assert.equal(fs.existsSync(path.join(release, 'backups')), false);
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
