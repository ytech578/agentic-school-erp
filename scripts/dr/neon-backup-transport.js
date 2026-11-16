'use strict';
// Ciphertext-only worker. Database credentials and decryption keys are never inputs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { projectName, storage, readBody, uploadObjects, sendAlert } = require('./identity-backup-transport');
const maximum = 96 * 1024 * 1024 + 35;
const filename = /^neon-\d+-[a-f0-9]{8}\.enc$/;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function validateManifest(bytes, project, name, now = Date.now()) {
  projectName(project); assert.match(name, filename); assert.ok(bytes.length <= 65536);
  const m = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(Object.keys(m).sort(), ['format', 'version', 'project', 'createdAt', 'postgresMajor', 'tableCount', 'archive'].sort());
  assert.equal(m.format, 'school-erp-neon-backup'); assert.equal(m.version, 1);
  assert.equal(m.project, project); assert.equal(m.postgresMajor, 16);
  assert.ok(Number.isInteger(m.tableCount) && m.tableCount >= 4 && m.tableCount <= 10000);
  assert.ok(Number.isFinite(Date.parse(m.createdAt)) && Date.parse(m.createdAt) <= now);
  assert.deepEqual(Object.keys(m.archive).sort(), ['file', 'bytes', 'sha256'].sort());
  assert.equal(m.archive.file, name); assert.match(m.archive.sha256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(m.archive.bytes) && m.archive.bytes > 35 && m.archive.bytes <= maximum);
  return m;
}
function manifestFor(bundle, encrypted, name) {
  const m = { format: 'school-erp-neon-backup', version: 1, project: bundle.project,
    createdAt: bundle.createdAt, postgresMajor: 16, tableCount: bundle.tables.length,
    archive: { file: name, bytes: encrypted.length, sha256: sha(encrypted) } };
  return validateManifest(Buffer.from(JSON.stringify(m)), m.project, name);
}
function prepareObjects(archive, bytes, project, name) {
  const m = validateManifest(bytes, project, name);
  assert.ok(archive.subarray(0, 7).equals(Buffer.from('ERPBAK1')));
  assert.equal(archive.length, m.archive.bytes); assert.equal(sha(archive), m.archive.sha256);
  return [{ key: `neon-backups/${project}/${name}`, body: archive, contentType: 'application/octet-stream' },
    { key: `neon-backups/${project}/${name}.json`, body: bytes, contentType: 'application/json' }]
    .map((o) => ({ ...o, bytes: o.body.length, sha256: sha(o.body) }));
}
async function main() {
  const [mode, project, name] = process.argv.slice(2); projectName(project);
  if (mode === 'alert') {
    const input = JSON.parse(await readBody(process.stdin, 4096)); assert.equal(input.project, project);
    console.log(JSON.stringify(await sendAlert(input, process.env, require('nodemailer').createTransport, 'database')));
    return;
  }
  assert.ok(['upload', 'download'].includes(mode)); assert.match(name, filename);
  const store = storage(process.env);
  try {
    if (mode === 'upload') {
      const file = path.join('/transfer', name);
      assert.ok(fs.statSync(file).size <= maximum && fs.statSync(file + '.json').size <= 65536);
      console.log(JSON.stringify(await uploadObjects(prepareObjects(fs.readFileSync(file),
        fs.readFileSync(file + '.json'), project, name), store)));
    } else {
      const prefix = `neon-backups/${project}/`;
      const bytes = await readBody((await store.get(prefix + name + '.json')).Body, 65536);
      const m = validateManifest(bytes, project, name);
      const archive = await readBody((await store.get(prefix + name)).Body, m.archive.bytes);
      const objects = prepareObjects(archive, bytes, project, name);
      fs.writeFileSync(path.join('/transfer', name), archive, { flag: 'wx', mode: 0o600 });
      fs.writeFileSync(path.join('/transfer', name + '.json'), bytes, { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ remoteCopyVerified: true, objects: objects.map(({ key, bytes, sha256 }) => ({ key, bytes, sha256 })),
        recoveryKeyDownloaded: false, restoreExecuted: false }));
    }
  } finally { store.destroy(); }
}
module.exports = { maximum, filename, validateManifest, manifestFor, prepareObjects };
if (require.main === module) main().catch(() => { console.error('NEON_BACKUP_TRANSPORT_FAILED; private diagnostics withheld'); process.exitCode = 1; });
