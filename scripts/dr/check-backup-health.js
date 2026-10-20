const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');

function inspectBackups(directory, { now = Date.now(), maxAgeHours = 26 } = {}) {
  const failures = [];
  let latest;
  for (const name of fs.existsSync(directory) ? fs.readdirSync(directory) : []) {
    if (!/^erp-[\dTZ.-]+\.dump\.enc\.json$/.test(name)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
      const createdAt = Date.parse(manifest.createdAt);
      if (!Number.isFinite(createdAt) || createdAt > now + 300000) continue;
      if (!latest || createdAt > latest.createdAt) latest = { name, manifest, createdAt };
    } catch { failures.push('UNREADABLE_MANIFEST'); }
  }
  if (!latest) failures.push('NO_SUCCESSFUL_ARCHIVE');
  else {
    const archive = path.join(directory, latest.name.slice(0, -5));
    if (!fs.existsSync(archive)) failures.push('ARCHIVE_MISSING');
    else if (crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== latest.manifest.sha256) failures.push('ARCHIVE_CHECKSUM_MISMATCH');
    if (now - latest.createdAt > maxAgeHours * 3600000) failures.push('BACKUP_STALE');
  }
  const scheduled = path.join(directory, 'scheduled-backup-status.json');
  if (fs.existsSync(scheduled)) {
    try { if (!JSON.parse(fs.readFileSync(scheduled, 'utf8')).success) failures.push('LATEST_SCHEDULED_RUN_FAILED'); }
    catch { failures.push('SCHEDULER_STATUS_UNREADABLE'); }
  }
  return { healthy: !failures.length, checkedAt: new Date(now).toISOString(), lastArchiveAt: latest ? new Date(latest.createdAt).toISOString() : null, maxAgeHours, failures, independentRemoteCopyVerified: Boolean(latest?.manifest.remoteCopy?.verified) };
}

async function main() {
  require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
  const maxAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS || 26);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours < 1 || maxAgeHours > 168) throw new Error('Invalid backup age threshold');
  const report = inspectBackups(path.join(root, 'backups/neon'), { maxAgeHours });
  console.log(JSON.stringify(report, null, 2));
  if (!report.healthy && process.argv.includes('--notify')) {
    if (!process.env.BACKUP_ALERT_EMAIL || !process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error('Configure backup alert recipient and SMTP before enabling notifications');
    const mail = require(require.resolve('nodemailer', { paths: [path.join(root, 'apps/api')] }));
    const transport = mail.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined, connectionTimeout: 15000, socketTimeout: 15000 });
    try { await transport.sendMail({ from: process.env.SMTP_FROM, to: process.env.BACKUP_ALERT_EMAIL, subject: 'ERP backup requires attention', text: `Backup health: ${report.failures.join(', ')}. Last archive: ${report.lastArchiveAt || 'none'}. No credentials or student records are included.` }); }
    finally { transport.close(); }
  }
  if (!report.healthy) process.exitCode = 1;
}
module.exports = { inspectBackups };
if (require.main === module) main().catch(() => { console.error('Backup-health check or alert delivery failed; no credentials were logged.'); process.exitCode = 1; });
