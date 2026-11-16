# Disaster recovery and restore verification

## Latest staging evidence (17 November 2026 IST)

Daily VM-based encrypted Neon and Authentik backups with verified private R2 copies
are enabled; the first timed runs for both have been accepted. Neon same-host
recovery matched all 76 tables; Authentik same-host recovery included operator MFA
login. Independent Google monitoring passed failure/recovery email tests. These
supersede the older local-only/scheduling-pending snapshots below, not the remaining
production requirements.

Separate-host and independently held-key recovery, full ERP/document/role recovery,
current provider PITR acceptance and overall production approval remain pending.
The assessed laptop has stopped Docker Desktop, no ordinary Linux distribution and
only 1.93 GiB free physical RAM; no recovery key or backup was copied to it.
See `production-readiness-2026-11-17.md` for the current ordered gates and evidence.

## Service objectives

| Workload | RPO | RTO | Recovery source |
| --- | --- | --- | --- |
| Primary PostgreSQL database | 15 minutes | 4 hours | Provider point-in-time recovery plus daily encrypted backup |
| Object storage / learner documents | 24 hours | 8 hours | Versioned bucket replication and daily inventory |
| Application configuration | 24 hours | 4 hours | Version-controlled deployment manifests and secret-manager recovery procedure |

These objectives are production requirements. A deployment is not production-ready until its database provider, object-storage provider, backup retention, and owning on-call team are recorded in the release runbook.

## Current Neon Free deployment boundary (2026-10-18)

The ERP now runs on a dedicated Neon PostgreSQL database. Its verified provider
restore history is six hours, not the 35-day target below. Consistent AES-256-GCM
backups, a tested daily Windows task and an isolated local restore drill are
implemented; all 76 table checksums matched. Backups are still local, uploads
are still local, and the Windows task needs a signed-in user and Docker.
Cross-region recovery storage, object replication, always-on scheduling/alerts
and a real provider PITR drill are not provisioned. See `docs/neon-setup.md` and
`docs/enterprise-security-status-2026-10-18.md` for actual evidence and commands.

## Required controls

Authentik has a separate encrypted offline backup and isolated restore tool.
Local database/file integrity and restored password/TOTP login passed on
2026-10-20. See `docs/identity-recovery.md`; independent storage/key custody,
production scheduling and a second-host identity restore remain pending.

- Enable encrypted automated database backups and point-in-time recovery with at least 35 days retention.
- Enable object versioning, encryption, and a separate-region replication policy for production uploads.
- Store credentials only in the approved secret manager; do not include them in images, browser bundles, source control, or backups.
- Run `npx prisma migrate deploy` as a single controlled release step before application rollout. Do not run schema-mutating commands from every application replica.
- Protect backup deletion and recovery actions with separate privileged roles and audit them.

## Quarterly restore drill

1. Open an incident ticket and record the drill start time, environment, backup/PITR timestamp, and operators.
2. Restore the database into an isolated recovery environment at a chosen point within the RPO.
3. Restore a representative sample of encrypted uploads, including PDFs and images, and verify checksums and access controls.
4. Deploy the exact release manifest against the restored environment; run `npx prisma migrate status` and the authenticated smoke tests.
5. Verify tenant isolation, fee-record integrity, document download authorization, and notification-provider health without sending messages to real users.
6. Measure recovery time, data loss window, and any manual steps. Record failures and remediation owners before closing the drill.

## Incident recovery

Declare an incident, stop writes where necessary, select a recovery point approved by the incident commander, restore into an isolated environment first, validate integrity and tenant boundaries, then schedule the controlled cutover. Never overwrite the affected production database until the recovery copy has passed validation and a rollback plan is documented.
