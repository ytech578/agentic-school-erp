# Encryption/MFA migration: local restore rehearsal only

## Boundary

This package has **no live or Neon migration mode**. Approval on 2026-11-07
covered project changes and a rehearsal on the verified local restore only.
Neither active `apps/api/.env` nor `.env.runtime` is changed. No existing
password, authenticator enrollment, recovery-code hash or school data is reset.

The existing configuration omitted an explicit PII encryption key and recovery
pepper. One stored MFA seed was confirmed to use the development fallback.
Generating a new primary key without re-encrypting that seed would break MFA.
Recovery-code HMACs cannot be re-keyed without their original codes, so the
previous pepper is retained for verification; new codes use the new pepper.

## Before running

1. Create a fresh encrypted Neon backup using `npm run db:neon:backup`.
2. Verify it using `npm run db:neon:backup:verify -- <archive>`.
3. Restore it locally using `npm run db:neon:restore:drill -- <archive>`.
4. Select that operation's explicit `backups/neon/restore-drill-*.json` report.
5. Build the API: `npm run build --workspace=apps/api`.

The script requires the built application's crypto implementation rather than
duplicating its development-key derivation. It reads `LOCAL_DATABASE_URL` only
for connections. The target must be literal loopback, the public schema, and
the exact `erp_neon_drill_<timestamp>_<nonce>` database from the successful
restore report. Unsupported connection parameters and non-administrator roles
are refused. An administrator is necessary for complete test-copy verification;
these owner credentials must never be given to the deployed API.

## Commands (Windows PowerShell, repository root)

Read-only inventory, with no generated keys or database writes:

```powershell
npm run security:encryption:local -- --restore-report backups/neon/restore-drill-<nonce>.json
```

Apply **to that local copy only**, then verify:

```powershell
npm run security:encryption:local -- --restore-report backups/neon/restore-drill-<nonce>.json --apply-local
```

Do not repeat `--apply-local` on an already re-keyed copy. Restore a new copy for
another rehearsal. The tool refuses old ciphertext that it cannot authenticate
and refuses starting another pepper rotation while an earlier one is pending.

## Checks and private artifacts

- All encrypted envelopes must authenticate before keys are written.
- A deliberately aborted migration must leave the test database unchanged,
  including transactional audit events.
- The committed local migration changes only the explicitly listed encryption
  columns. It uses compare-and-swap updates without changing `updatedAt` or
  resetting MFA/password/session state.
- Fingerprints cover every other business value, including password hashes and
  the original recovery-code arrays. Historical audit snapshots are checked;
  new updates must produce transactional audit events.
- Actual enrolled MFA seeds are checked through the built AuthService challenge
  verifier in production-key mode, with no seed or OTP written to a report.
- Synthetic recovery codes check old/new peppers, invalid/missing codes, replay
  denial and two overlapping CAS consumption requests. These probes run in one
  transaction and are rolled back, including their synthetic user and audits.
  This is not an independent-connection load test or browser/password login test.
- Source environment file fingerprints must remain unchanged.

Only existing `enc:v1:` fields are re-keyed. This is not a full PII audit or a
plaintext-data encryption migration, and it does not rewrite historical audit
snapshots, backups or arbitrary JSON fields.

Artifacts are stored exclusively in a new ignored directory under
`backups/security-migration/`:

- `application-secrets.env`: new PII key, new recovery pepper and the previous
  recovery pepper. No database-owner URL or backup key is exported. The old
  development PII key is not exported.
- `local-rotation.journal.enc`: authenticated encrypted before/after ciphertext
  journal, protected by a context-separated key derived from the new PII key.
- `verification.json`: non-secret test results. A success report does not approve
  production deployment or assert that the live database was migrated.

The directory is mode 0700 and secret files are mode 0600 on POSIX. On Windows,
inherited directory permissions are removed and the current user's SID is granted
access **before** any key files are created. Keep keys private; do not paste them
into chat, commits, screenshots, application logs or a document-storage bucket.
Private artifacts are retained on failure for operator inspection. A failed
post-commit check may leave the **local copy** rotated: restore a new local copy
instead of guessing keys or changing the active environment.

## After a successful rehearsal

Stop here. Applying this change to live Neon, changing active configuration,
transferring secrets to the VM, and starting cloud services require a separately
approved cutover. Do **not** load the generated key file into the current ERP:
its live MFA seed still uses the old key until that cutover.

Before live cutover: preserve an independent encrypted backup and separate key
custody, quiesce all processes using that database, implement/review a live-target
migration with explicit identity checks, and prepare coordinated rollback of
both ciphertext and environment. Never roll back the key file alone.

`MFA_RECOVERY_CODE_PEPPER_PREV` is verification-only. Do not remove it until all
old recovery-code sets have been consumed or safely replaced through an approved
authenticated process. This patch does not add a recovery-code regeneration UI
or silently revoke old codes. Docker Compose now forwards the optional previous
pepper; the runtime exporter already preserves it.

Cloud HTTPS status-page checks, R2 settings, and Authentik provisioning are
separate deployment work. No cloud containers, DNS, R2 objects or Neon records
are changed by this rehearsal.
