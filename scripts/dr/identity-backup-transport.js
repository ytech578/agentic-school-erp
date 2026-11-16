/** Runs in an isolated dependency image. NEVER accepts a recovery key or runtime env. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const maximum = 128 * 1024 * 1024 + 35;
const filename = /^identity-\d+-[a-f0-9]{8}\.enc$/;
function projectName(project) {
  assert.match(project, /^[a-z0-9][a-z0-9_-]{1,62}$/);
  return project;
}
function validateManifest(bytes, project, name, now = Date.now()) {
  projectName(project); assert.match(name, filename); assert.ok(bytes.length <= 65536);
  const m = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(Object.keys(m).sort(), ['archive', 'createdAt', 'databaseImage', 'format',
    'identityImage', 'independentCopyVerified', 'sourceProject', 'version', 'volumeTargets'].sort());
  assert.equal(m.format, 'school-erp-identity-backup'); assert.equal(m.version, 1);
  assert.equal(m.sourceProject, project); assert.equal(m.independentCopyVerified, false);
  assert.ok(Number.isFinite(Date.parse(m.createdAt)) && Date.parse(m.createdAt) <= now);
  assert.match(m.databaseImage, /^sha256:[a-f0-9]{64}$/);
  assert.match(m.identityImage, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(m.volumeTargets, ['/certs', '/data', '/templates']);
  assert.deepEqual(Object.keys(m.archive).sort(), ['bytes', 'file', 'sha256']);
  assert.equal(m.archive.file, name); assert.match(m.archive.sha256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(m.archive.bytes) && m.archive.bytes > 35 && m.archive.bytes <= maximum);
  return m;
}
function prepareObjects(archive, manifestBytes, project, name) {
  const m = validateManifest(manifestBytes, project, name);
  assert.equal(archive.length, m.archive.bytes);
  assert.ok(archive.subarray(0, 7).equals(Buffer.from('ERPBAK1')));
  assert.equal(sha(archive), m.archive.sha256);
  const prefix = `identity-backups/${project}/`;
  return [
    { key: prefix + name, body: archive, contentType: 'application/octet-stream' },
    { key: prefix + name + '.json', body: manifestBytes, contentType: 'application/json' },
  ].map((o) => ({ ...o, bytes: o.body.length, sha256: sha(o.body) }));
}
async function readBody(body, limit) {
  const pieces = []; let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > limit) { body.destroy?.(); throw new Error('OBJECT_TOO_LARGE'); }
    pieces.push(chunk);
  }
  return Buffer.concat(pieces);
}
async function verifyResponse(response, expected) {
  const body = await readBody(response.Body, expected.bytes);
  assert.equal(body.length, expected.bytes); assert.equal(sha(body), expected.sha256);
}
async function uploadObjects(objects, store) {
  const receipt = [];
  for (const object of objects) {
    let exists = false;
    try { await verifyResponse(await store.get(object.key), object); exists = true; }
    catch (error) {
      if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NoSuchKey') throw error;
    }
    if (!exists) {
      try { await store.put(object); }
      catch {
        // Unknown write outcome: read the exact key, never overwrite or delete.
        await verifyResponse(await store.get(object.key), object);
      }
      await verifyResponse(await store.get(object.key), object);
    }
    receipt.push({ key: object.key, bytes: object.bytes, sha256: object.sha256,
      downloadedAndVerified: true, existingIdenticalCopy: exists });
  }
  return { checkedAt: new Date().toISOString(), remoteCopyVerified: true,
    objects: receipt, recoveryKeyUploaded: false, credentialsUploaded: false, publicAccessChanged: false };
}
function storage(env) {
  const endpoint = new URL(env.S3_ENDPOINT);
  assert.equal(endpoint.protocol, 'https:');
  assert.ok(endpoint.hostname.endsWith('.r2.cloudflarestorage.com'));
  assert.ok(!endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && endpoint.pathname === '/');
  assert.ok(env.S3_BUCKET_NAME && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ endpoint: endpoint.href, region: env.S3_REGION || 'auto',
    forcePathStyle: true, maxAttempts: 3,
    requestHandler: { connectionTimeout: 10000, requestTimeout: 60000 },
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } });
  return {
    get: (key) => client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key })),
    put: (o) => client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: o.key,
      Body: o.body, ContentType: o.contentType, CacheControl: 'private, no-store',
      Metadata: { sha256: o.sha256 }, IfNoneMatch: '*' })),
    destroy: () => client.destroy(),
  };
}
function smtpOptions(env) {
  const address = /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/;
  assert.match(env.BACKUP_ALERT_EMAIL || '', address); assert.match(env.SMTP_FROM || '', address);
  assert.match(env.SMTP_HOST || '', /^[a-zA-Z0-9.-]+$/);
  const port = Number(env.SMTP_PORT || 587); assert.ok([465, 587].includes(port));
  assert.ok(Boolean(env.SMTP_USER) === Boolean(env.SMTP_PASSWORD));
  return { host: env.SMTP_HOST, port, secure: port === 465, requireTLS: true,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: env.SMTP_HOST },
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000 };
}
async function sendAlert(input, env, createTransport, category = 'identity') {
  assert.ok(['identity', 'database'].includes(category));
  assert.deepEqual(Object.keys(input).sort(), ['codes', 'project']); projectName(input.project);
  assert.ok(Array.isArray(input.codes) && input.codes.length > 0 && input.codes.length <= 16);
  input.codes.forEach((code) => assert.match(code, /^[A-Z][A-Z0-9_]{0,63}$/));
  const transport = createTransport(smtpOptions(env));
  try {
    const result = await transport.sendMail({ from: env.SMTP_FROM, to: env.BACKUP_ALERT_EMAIL,
      subject: `ERP ${category} backup requires attention: ${input.project}`,
      text: `Project: ${input.project}\nChecks: ${input.codes.join(', ')}\nNo school records or credentials are included. Inspect the private backup status on the server.` });
    assert.ok(result.accepted?.length === 1 && !result.rejected?.length);
    return { acceptedBySmtp: true, inboxDeliveryVerified: false };
  } finally { transport.close(); }
}
async function main() {
  const [mode, project, name] = process.argv.slice(2); projectName(project);
  if (mode === 'alert') {
    const data = await readBody(process.stdin, 4096);
    const input = JSON.parse(data); assert.equal(input.project, project);
    console.log(JSON.stringify(await sendAlert(input, process.env, require('nodemailer').createTransport)));
    return;
  }
  assert.ok(['upload', 'download'].includes(mode)); assert.match(name, filename);
  const store = storage(process.env);
  try {
    if (mode === 'upload') {
      const archivePath = path.join('/transfer', name);
      assert.ok(fs.statSync(archivePath).size <= maximum);
      assert.ok(fs.statSync(archivePath + '.json').size <= 65536);
      console.log(JSON.stringify(await uploadObjects(prepareObjects(fs.readFileSync(archivePath),
        fs.readFileSync(archivePath + '.json'), project, name), store)));
    } else {
      const prefix = `identity-backups/${project}/`;
      const manifestBytes = await readBody((await store.get(prefix + name + '.json')).Body, 65536);
      const m = validateManifest(manifestBytes, project, name);
      const archive = await readBody((await store.get(prefix + name)).Body, m.archive.bytes);
      const objects = prepareObjects(archive, manifestBytes, project, name);
      // Exclusive writes: never replace a previous download or any recovery key.
      fs.writeFileSync(path.join('/transfer', name), archive, { flag: 'wx', mode: 0o600 });
      fs.writeFileSync(path.join('/transfer', name + '.json'), manifestBytes, { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ remoteCopyVerified: true, objects: objects.map(({ key, sha256, bytes }) => ({ key, sha256, bytes })),
        recoveryKeyDownloaded: false, restoreExecuted: false }));
    }
  } finally { store.destroy(); }
}
module.exports = { projectName, validateManifest, prepareObjects, verifyResponse, uploadObjects, smtpOptions, sendAlert, storage, readBody };
if (require.main === module) main().catch(() => {
  console.error('IDENTITY_BACKUP_TRANSPORT_FAILED; private provider diagnostics withheld'); process.exitCode = 1;
});
