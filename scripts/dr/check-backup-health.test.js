const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { inspectBackups } = require('./check-backup-health');
test('backup health detects missing, stale, corrupt and failed scheduled backups', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-backup-health-'));
  try {
    const now = Date.now();
    assert(inspectBackups(directory, { now }).failures.includes('NO_SUCCESSFUL_ARCHIVE'));
    const archive = path.join(directory, 'erp-2026-10-19T00-00-00-000Z.dump.enc');
    fs.writeFileSync(archive, 'encrypted-fixture');
    const manifest = { createdAt: new Date(now).toISOString(), sha256: crypto.createHash('sha256').update('encrypted-fixture').digest('hex') };
    fs.writeFileSync(archive + '.json', JSON.stringify(manifest));
    assert.equal(inspectBackups(directory, { now }).healthy, true);
    assert(inspectBackups(directory, { now: now + 27 * 3600000 }).failures.includes('BACKUP_STALE'));
    fs.writeFileSync(archive, 'tampered');
    fs.writeFileSync(path.join(directory, 'scheduled-backup-status.json'), JSON.stringify({ success: false }));
    const report = inspectBackups(directory, { now });
    assert(report.failures.includes('ARCHIVE_CHECKSUM_MISMATCH'));
    assert(report.failures.includes('LATEST_SCHEDULED_RUN_FAILED'));
  } finally { for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name)); fs.rmdirSync(directory); }
});
