const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const folder = path.join(root, 'backups/identity');
const envFile = path.join(root, 'infrastructure/authentik/.env.authentik');
const secretsFile = path.join(folder, 'development-secrets.json');
function command(args) {
  const executable = process.env.OPENSSL_BIN || 'C:/Program Files/Git/usr/bin/openssl.exe';
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Development certificate generation failed');
}
function main() {
  fs.mkdirSync(path.join(folder, 'tls'), { recursive: true });
  let secrets;
  if (fs.existsSync(secretsFile)) secrets = JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
  else {
    secrets = { schemaVersion: 1, adminPassword: crypto.randomBytes(30).toString('base64url'), bootstrapToken: crypto.randomBytes(40).toString('hex'), fixturePassword: crypto.randomBytes(28).toString('base64url'), runtimePassword: crypto.randomBytes(28).toString('hex') };
    fs.writeFileSync(secretsFile, JSON.stringify(secrets), { flag: 'wx', mode: 0o600 });
  }
  let env = fs.readFileSync(envFile, 'utf8');
  if (!/^AUTHENTIK_BOOTSTRAP_TOKEN=/m.test(env)) {
    const salt = crypto.randomBytes(12).toString('hex');
    const hash = `pbkdf2_sha256$1000000$${salt}$${crypto.pbkdf2Sync(secrets.adminPassword, salt, 1000000, 32, 'sha256').toString('base64')}`;
    env += `\nAUTHENTIK_BOOTSTRAP_TOKEN=${secrets.bootstrapToken}\nAUTHENTIK_BOOTSTRAP_PASSWORD_HASH='${hash}'\n`;
    fs.writeFileSync(envFile, env, { mode: 0o600 });
  }
  const tls = path.join(folder, 'tls');
  if (!fs.existsSync(path.join(tls, 'localhost.pem'))) {
    command(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '30', '-subj', '/CN=School ERP Development CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', path.join(tls, 'ca.key'), '-out', path.join(tls, 'ca.pem')]);
    command(['req', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-subj', '/CN=localhost', '-keyout', path.join(tls, 'localhost.key'), '-out', path.join(tls, 'localhost.csr')]);
    fs.writeFileSync(path.join(tls, 'localhost.ext'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nkeyUsage=critical,digitalSignature,keyEncipherment\nbasicConstraints=critical,CA:FALSE\n');
    command(['x509', '-req', '-sha256', '-days', '30', '-in', path.join(tls, 'localhost.csr'), '-CA', path.join(tls, 'ca.pem'), '-CAkey', path.join(tls, 'ca.key'), '-CAcreateserial', '-extfile', path.join(tls, 'localhost.ext'), '-out', path.join(tls, 'localhost.pem')]);
  }
  console.log(JSON.stringify({ developmentSecretsPrepared: true, localTlsPrepared: true, systemTrustModified: false }));
}
try { main(); } catch { console.error('Identity development initialization failed; no secrets were logged.'); process.exitCode = 1; }
