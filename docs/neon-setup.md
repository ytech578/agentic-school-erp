# Dedicated Neon project for the school ERP

## Provisioned ERP project

Created and independently read back through the Neon integration on 2026-10-18
(Asia/Calcutta):

- Name: Agentic School ERP
- Project ID: `quiet-frog-11450462`
- Console: https://console.neon.tech/app/projects/quiet-frog-11450462
- Region: `aws-ap-southeast-1` (Singapore)
- PostgreSQL: 16
- Account subscription verified: `free_v3`
- Database logical-size limit reported by Neon: 1,073,741,824 bytes
- Compute settings: 0.25 CU minimum and maximum
- Recovery history reported by Neon: 21,600 seconds (6 hours)
- Requested bootstrap: branch `main`, database `school_erp`, owner `school_erp_owner`

Connection setup, schema/data migration, restricted runtime-role verification,
and application cutover completed on 2026-10-18. The API uses the pooled
`school_erp_runtime` connection with RLS enabled. The original localhost URL is
preserved as `LOCAL_DATABASE_URL`; the local source database was not removed.
The unrelated Neon project has not been modified. No passwords are stored here.

## Current boundary

The existing Neon project belongs to a different application. Do not apply ERP
migrations, seed scripts, runtime-role changes, or restores to that project's
database. Create a dedicated Neon project for the ERP, or explicitly designate
a separate ERP database after confirming the intended isolation requirements.
The ERP migration targets only project `quiet-frog-11450462`, database `school_erp`.

## Verified cutover evidence

- Original 74 tables / 47,920 rows matched source counts and per-table checksums
  after the local API writer was stopped and the final authentication changes
  were reconciled. These are migration-time totals, not current live row counts.
- The transactional snapshot migration was then applied: 76 public tables.
- Restricted-role tests passed for both schools: no unscoped tenant reads,
  cross-tenant writes denied, and owner/bypass privileges absent.
- Live audit probes verified before/after snapshots, secret redaction, rollback
  atomicity and denial of audit deletion by the application role.
- Live password + MFA sign-in, profile, own/admin session listing, identity
  provider listing and document-security listing returned successfully. Logout
  immediately invalidated the test access token.
- SCIM discovery and error responses were checked as raw SCIM protocol responses,
  not the ERP response wrapper. No real external IdP is configured yet.
- Ignored verification reports: `backups/db/neon-migration-verification.json`
  and `backups/db/neon-runtime-verification.json`.

## Active credential separation

`DATABASE_URL` and `NEON_RUNTIME_DATABASE_URL` use the restricted pooled role.
`NEON_DATABASE_URL` and `MIGRATION_DATABASE_URL` use the direct owner connection
only for administrative tooling. Do not replace the runtime URL with the owner
URL. In a hosted production deployment, give the API only runtime credentials;
inject owner/backup credentials into a separate controlled migration/backup job.
The current combined ignored environment file is for this local workstation.

## Connect and inspect

1. Connect the Neon integration, select the intended account, and identify a
   dedicated ERP project/database. Record its actual region and plan quotas.
2. In the Neon Connect dialog, copy the direct owner connection into
   `NEON_DATABASE_URL` in `apps/api/.env` (which is ignored by Git). Include
   `sslmode=require`. This staging variable does not switch the running ERP
   away from its current local `DATABASE_URL`. Do not paste secrets into chat.
3. Run `npm run db:neon:check` from the repository root. It performs only SELECTs
   inside a read-only transaction, reports the database size and role privileges,
   and distinguishes an empty target, an ERP schema, and unrelated existing tables.
   Its unit tests validate behavior; they are not evidence of a live Neon connection.
4. Before any cloud write, confirm the exact target. Back up any existing target
   contents and the local ERP source. Inspect the migration status and data import
   plan. A blank database needs migrations; a database with an existing unrelated
   schema is not a migration target. Never use reset or force-push against it.

## Migration and runtime credentials

This repository uses Prisma 5; retain its existing generated client and migration
chain. Do not upgrade Prisma or copy a Prisma 7 configuration just to connect Neon.
Use the direct owner connection only in a controlled migration process. Keep the
API's `DATABASE_URL` separate: a pooled TLS connection for a SQL-created LOGIN
role with NOBYPASSRLS, no table ownership, and no membership in an owner/bypass role.
Neon roles created through its console/API may have elevated membership; verify
effective role privileges rather than assuming a new role is restricted.

After applying migrations, configure the application role using the existing
`scripts/db/configure-runtime-role.sql` with the actual ERP database name.
Validate managed-Neon compatibility and effective role memberships before using
that script; do not assume AWS IAM roles exist on Neon. Set
`DATABASE_RLS_ENABLED=true` only together with the configured restricted connection.
Use a finite `connect_timeout=15` to allow an inactive compute to wake.

Before cutover, validate login/MFA, session revocation, reads and writes under the
restricted role, isolation between two ERP tenants, and background system jobs.
Keep the local source intact until cloud row counts and key business totals match.

## Files and recovery

A PostgreSQL connection does not migrate uploaded files or Redis. Keep document
storage and Redis configured separately until their migration is planned and
verified. Private object access, malware scanning, and retention remain required.

Check the project's actual free-plan quotas and restore history in the console.
The free restore window does not satisfy the original 35-day recovery requirement.
Independent encrypted backups, a separate recovery destination, scheduled checks,
and a measured restore drill must be deployed and verified before claiming that
enterprise disaster recovery is complete. No paid subscription is enabled by this
preparation.

## Encrypted backup and local recovery drill

Follow-up 2026-10-19: see `docs/enterprise-progress-2026-10-19.md`. Scheduled
backups now use host-resolved DNS with full TLS hostname verification, bounded
retries and a backup-age/integrity check. The scheduled run and a fresh 76-table
restore succeeded. A storage destination/independent monitor still does not exist.

The implemented backup uses a PostgreSQL exported snapshot, so table checksums
and the archive refer to the same database state. Archives are encrypted with
AES-256-GCM and include a SHA-256 manifest. A real backup was restored into a new
isolated local database; all 76 table counts/checksums matched. The drill database
was retained for inspection, and the live/source databases were not overwritten.

From the repository root:

```powershell
npm run db:neon:backup
npm run db:neon:backup:verify -- "D:\path\to\archive.dump.enc"
npm run db:neon:restore:drill -- "D:\path\to\archive.dump.enc"
```

These commands require Docker and the local PostgreSQL utility container.
Preserve `BACKUP_ENCRYPTION_KEY` in a separate secure recovery location. Losing
the key makes encrypted archives unrecoverable. Preserve the PII encryption key
separately too; restoring database rows does not decrypt encrypted application data.

Windows task `Agentic School ERP - Encrypted Neon Backup` is registered for
02:00 daily, with missed-start recovery and overlapping runs disabled. The
actual scheduled runner was executed successfully (exit 0), and its resulting
archive passed authentication/checksum/decryption/archive validation. It runs
only while the current user is signed in, Docker Desktop is running, and the
computer has network access. This is workstation automation, not an always-on
cloud backup service. Status is in
`backups/neon/scheduled-backup-status.json`; non-secret diagnostics are in
`backups/neon/scheduled-backup.log`. Monitor failures and backup age externally
before production. The task does not send alerts by itself.

`BACKUP_SECONDARY_DIRECTORY` can copy encrypted archives and manifests to an
independently provisioned recovery destination. It is not configured. A second
directory on the same computer does not establish cross-region recovery.
Provider PITR restore, independent cross-region storage, upload replication and
an always-on backup/alerting service remain deployment prerequisites.

References:
- https://neon.com/docs/guides/prisma
- https://neon.com/docs/manage/roles
- https://neon.com/pricing
