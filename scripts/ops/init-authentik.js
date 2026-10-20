const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const file = path.resolve(__dirname, '../../infrastructure/authentik/.env.authentik');
try {
  fs.writeFileSync(file, `AUTHENTIK_PG_PASSWORD=${crypto.randomBytes(32).toString('hex')}\nAUTHENTIK_SECRET_KEY=${crypto.randomBytes(60).toString('hex')}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Isolated Authentik secrets created. No existing identity password or ERP login was changed.');
} catch { console.error('Identity secrets were not changed; check whether the file already exists.'); process.exitCode = 1; }
