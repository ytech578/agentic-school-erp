/** Incremental encrypted audit export. No database rows are modified or deleted. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { encryptArchive, decryptArchive } = require('../dr/neon-backup');
const root = path.resolve(__dirname, '../..');

function validateCheckpoint(value) {
  if (!/^\d+$/.test(value.nextTransactionId) || (value.afterId && !/^[a-f0-9-]{36}$/i.test(value.afterId))) throw new Error('Invalid audit export checkpoint');
  return value;
}
async function main() {
  require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
  const keyText = process.env.AUDIT_EXPORT_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(keyText)) throw new Error('Audit export encryption key required');
  const key = Buffer.from(keyText, 'hex');
  const directory = path.join(root, 'backups/audit');
  fs.mkdirSync(directory, { recursive: true });
  const checkpointFile = path.join(directory, 'checkpoint.json');
  const lockFile = path.join(directory, 'export.lock');
  const lock = fs.openSync(lockFile, 'wx', 0o600);
  const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [path.join(root, 'apps/api')] }));
  const source = new URL(process.env.AUDIT_EXPORT_DATABASE_URL || process.env.MIGRATION_DATABASE_URL || process.env.NEON_DATABASE_URL);
  const sourceFingerprint = crypto.createHash('sha256').update(source.hostname.replace('-pooler.', '.') + source.pathname).digest('hex');
  const db = new PrismaClient({ datasourceUrl: source.href, log: [] });
  let count = 0, files = 0;
  try {
    let checkpoint = validateCheckpoint(fs.existsSync(checkpointFile) ? JSON.parse(fs.readFileSync(checkpointFile, 'utf8')) : { nextTransactionId: '0', afterId: '' });
    if (fs.existsSync(checkpointFile) && checkpoint.sourceFingerprint !== sourceFingerprint && !(process.argv.includes('--bind-existing-source') && !checkpoint.sourceFingerprint)) throw new Error('Audit checkpoint belongs to a different or unbound database; operator review required');
    const save = (next) => {
      next.sourceFingerprint = sourceFingerprint;
      fs.writeFileSync(checkpointFile + '.tmp', JSON.stringify(next), { mode: 0o600 });
      fs.renameSync(checkpointFile + '.tmp', checkpointFile);
      checkpoint = next;
    };
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      // Transactions below xmin have finished. A createdAt-only cursor can miss
      // late commits; this fence cannot skip a still-running business write.
      const [snapshot] = await tx.$queryRawUnsafe('SELECT txid_snapshot_xmin(txid_current_snapshot())::text AS fence');
      if (!/^\d+$/.test(snapshot.fence)) throw new Error('Invalid audit transaction fence');
      if (BigInt(snapshot.fence) < BigInt(checkpoint.nextTransactionId)) throw new Error('Database transaction history moved backwards; review checkpoint after restore');
      while (true) {
        const rows = await tx.$queryRawUnsafe('SELECT * FROM domain_audit_events WHERE "transactionId">=$1::bigint AND "transactionId"<$2::bigint AND ("transactionId">$1::bigint OR id::text>$3) ORDER BY "transactionId",id LIMIT 500', checkpoint.nextTransactionId, snapshot.fence, checkpoint.afterId || '');
        if (!rows.length) { save({ nextTransactionId: snapshot.fence, afterId: '', updatedAt: new Date().toISOString() }); break; }
        const plain = Buffer.from(JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), events: rows }, (_, value) => typeof value === 'bigint' ? value.toString() : value));
        const encrypted = encryptArchive(plain, key);
        if (!decryptArchive(encrypted, key).equals(plain)) throw new Error('Audit archive verification failed');
        const name = `audit-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.json.enc`;
        fs.writeFileSync(path.join(directory, name), encrypted, { flag: 'wx', mode: 0o600 });
        fs.writeFileSync(path.join(directory, name + '.manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), rows: rows.length, sha256: crypto.createHash('sha256').update(encrypted).digest('hex') }));
        const last = rows[rows.length - 1];
        save({ nextTransactionId: last.transactionId.toString(), afterId: last.id, updatedAt: new Date().toISOString() });
        count += rows.length; files++;
      }
    }, { isolationLevel: 'RepeatableRead', timeout: 180000 });
    console.log(JSON.stringify({ exportedEvents: count, encryptedFiles: files, databaseWrites: false, independentOffHostCopy: false }));
  } finally { await db.$disconnect(); fs.closeSync(lock); fs.unlinkSync(lockFile); }
}
module.exports = { validateCheckpoint };
if (require.main === module) main().catch(() => { console.error('Encrypted audit export failed; no event contents or credentials were logged. Check configuration and any interrupted-run lock.'); process.exitCode = 1; });
