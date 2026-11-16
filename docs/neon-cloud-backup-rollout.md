# Always-on Neon ERP backups: staged rollout

## Read-only assessment, 12 November 2026

The repository's existing Neon backup uses an exported PostgreSQL snapshot and
per-table checksums, but its scheduler runs on Windows while the operator is
signed in with Docker Desktop available. It is not an always-on cloud service.

A read-only check of the staging VM confirmed:

- No `school-erp-neon*` systemd units or `/etc/school-erp-neon-backup` directory.
- The application environment excludes owner/migration database URLs and the Neon
  backup encryption key. Preserve this separation; do not add them to the API.
- Existing private R2 and Resend configuration files have 0600 permissions.
  Presence is not a new end-to-end connectivity test.
- All five checked ERP/identity services remain healthy and both Authentik backup
  timers remain active. No database connection, credential change, service restart,
  new paid resource or actual Neon backup was performed by this assessment.

Private VM evidence: `neon-backup-readiness-20261112.json` in the existing protected
identity-backup-package directory. No credential values are in this document.

## Approval boundary

The operator approved a separate service on the existing VM, the proposed 02:00 IST
schedule, encrypted R2 copies, separate credentials/key and failure alerts. This
does not remove the exact privilege-grant gate described below.

Before live provisioning, obtain explicit approval for a separate backup process
on the existing GCP VM, with a full-ERP read credential and encryption key stored
in root-only files outside the application configuration. This grants the process
access to every school's database records for backup, not user portal access.
The operator must enter any new credential privately. Do not reuse or transfer the
owner connection or workstation recovery key by inference, change runtime RLS,
or grant `neon_superuser` membership as a shortcut.

Approved policy, not yet activated: daily **02:00 Asia/Kolkata**, independent
hourly stale/failure checks using the existing approved Resend destination, private
R2 ciphertext copies under a separate ERP backup prefix, and no automatic deletion.
Do not disable the existing Windows task
until cloud acceptance passes and its replacement is explicitly approved.

## Implementation and acceptance sequence

1. Verify a dedicated direct/unpooled Neon backup credential can read the complete
   ERP schema across tenants while having the narrowest effective privileges the
   provider supports. Check role memberships, database identity, TLS hostname
   verification and all RLS-protected tables. A tenant-filtered runtime credential
   is not a full-database backup credential. Fail closed rather than setting
   `--enable-row-security`, inventing tenant context or weakening source policies.
   If Neon cannot supply a sufficiently restricted role, report the exact elevated
   access needed and obtain separate approval before storing it on the VM.
2. Build a separate Linux worker/scheduler, not an invocation inside the running
   ERP API or identity database. Preserve snapshot/checksum consistency, pinned
   PostgreSQL 16 tooling, bounded runtime, private temporary data, single-job locking,
   AES-256-GCM authentication and cleanup of invocation-owned plaintext only.
   Do not copy the workstation script unchanged: it assumes a development database
   container, local Prisma dependencies and repository-relative state paths.
3. Reuse reviewed transport/alert primitives where applicable, with separate ERP
   manifest validation and state. Allow only scoped R2 credentials and ciphertext
   into the transfer process; never give it the database credential or recovery key.
   Verify full GET checksums for archive and manifest before marking success.
4. Install root-owned code/configuration with timers disabled. Test success,
   source/RLS/target mismatch, corrupt data, interrupted upload, SMTP failure,
   stale/missing backup, overlap, timeout and cleanup paths without damaging live
   credentials or stopping the ERP. Keep failed run and failed alert state explicit.
5. With the operator's approval for the live read/export and private R2 transfer,
   run one manual backup and verify a genuinely isolated restore, including table
   inventory/counts/checksums. Never restore onto the live Neon database. Exporting
   a backup does not require an Authentik-style sign-in pause, but can impose read
   load and should have a bounded approved window.
6. Enable the agreed timers only after gates pass, then observe the first timed
   run and remote receipt separately. Retain recovery keys outside the VM through
   an operator-controlled private process and test that independent copy later.

This logical backup does not establish provider WAL/PITR, cross-region replication,
object-document recovery, a second-host drill, or independent VM-down alerting.
Existing free-plan limits and data-residency requirements remain separate gates.

## Disabled installation and final checks, 12 November 2026

The separate service was implemented and installed with both timers disabled and
inactive. Root-only private configuration/key files were verified, eleven installed
code/unit hashes matched the reviewed release, and the missing-credential preflight
refused before opening a database connection. Existing application configuration
was unchanged; all five checked ERP/identity services remained healthy and both
Authentik timers stayed active. A separate encryption key was generated on the VM
without displaying it; independent operator custody is not yet confirmed.

The final local operations suite passed **137 tests**. The targeted Linux suite
passed **14 tests**. A real PostgreSQL 16 synthetic fixture included both schools
despite RLS, held a consistent snapshot across a concurrent fixture write, included
an additional user schema and restored all five table counts/checksums. The hardened
non-root, network-disabled dump-list client was also exercised. Invocation-bound
cleanup prevents an old service hook from consuming a newer plan; PostgreSQL image
data volumes are overridden with volatile mounts. All synthetic resources were
confirmed absent afterwards. No live Neon school data was exported or restored.

The new service has **not** completed real backup, R2, inbox-alert or restore
acceptance. No Neon backup timer was enabled. Read-only role inspection confirmed
`school_erp_backup` does not exist. Automatic creation was rejected by security
review because the exact persistent `BYPASSRLS`/read-all grant needs explicit
operator approval. The rejection was not bypassed; no administrator/owner fallback
or RLS-policy modification was attempted. The guarded inactive reader provisioner
is prepared locally but must not be executed again until the exact grant is approved.

Private release and verification evidence is retained at
`/opt/school-erp-neon-backup-release-20261112-4e6caac7`, including
`disabled-installation-acceptance.json`, `linux-snapshot-fixture-final-verification.json`
and `final-readiness-20261112.json`. The latter verified current state at
2026-11-12T16:26:40.357638Z. See `infrastructure/backups/neon/README.md` for limits,
credential handling and the remaining activation gates. The original broad Git
ignore for directories named `backups` now explicitly permits the infrastructure
backup source directory while real archives, keys and filled env files stay ignored.

## Inactive reader explicitly approved and created, 12 November 2026

After the operator explicitly approved creation of the inactive database role,
the guarded transaction created `school_erp_backup` with `NOLOGIN`, `BYPASSRLS`,
membership only in `pg_read_all_data`, and a connection limit of three. No password
was set. It has default read-only transactions and bounded statement/idle timeouts.
No owner connection was transferred to the VM or application runtime.

Independent post-commit metadata checks in a read-only transaction passed at
2026-11-12T16:40:04.665Z: all user tables are selectable; no user-table write,
object-ownership, schema/database creation, superuser, role/database creation,
replication or elevated membership privileges were present. The existing ERP
runtime role still has login enabled with no RLS bypass or superuser privilege.
No application rows, RLS policies or runtime-role grants were changed. The private
local report is `backups/onboarding/neon-inactive-backup-role-postcommit-verification-20261112.json`.

The exact inactive-reader grant gate is now complete. Password/login activation,
private VM connection setup, independent key custody, real backup/R2/alert/restore
acceptance and timer enablement are still pending. No such later action is implied
by the inactive-role creation. Earlier disabled-installation receipts are historical
and have not been rewritten to claim the role existed before this approval.

## Independent Neon key custody attested, 12 November 2026

The operator confirmed "Neon key saved outside VM" for the new Neon backup
recovery key. This records operator attestation only: the storage type was not
specified, the independent copy was not inspected, and recovery using that copy
has not been tested. The Authentik recovery key is separate.

The private password helper's non-secret completion report is not yet present.
Password/login activation and private connection transfer therefore remain
unconfirmed; real backup, R2, alert and isolated restore acceptance remain pending.
Both Neon backup timers remain disabled. No credential or key contents were read
to record this confirmation, and no live database change was made for this step.

## Retained private setup reviewed, 14 November 2026

The operator entered matching 32-character password values and submitted the
activation prompt, but no completion report was created. The retained connection
file was preserved. An additional normal invocation correctly refused that existing
private setup instead of overwriting it. Read-only checks confirmed the backup
reader still has `NOLOGIN`, its approved non-administrative permissions pass the
inactive-role guard, and the owner already has CREATEROLE and ADMIN OPTION on it.
No additional role grant is needed. No password change was retried by the agent.

Review found a provider incompatibility in the original helper: it supplied a
client-generated SCRAM verifier, while Neon's documented SQL password interface
requires the original password and does not support supplied hashes. The original
failure's SQLSTATE was not retained, so this finding is not a recovered server
error log. The revised operator-only helper uses a safely escaped password literal
over verified TLS and never prints SQL, raw errors or credentials. The obsolete
SCRAM-generation path was removed. Strict role, target and TLS checks remain.

An explicit `--resume-inactive-setup` path now reuses the retained protected
connection without showing its password, replacing it, or deleting it on cancelled
preflight/input. It refuses active roles and requires the operator's final
`ACTIVATE` submission. Ownership/ACL metadata passed on the retained Windows files.
A real protected synthetic fixture also passes; the check explicitly imports
Windows PowerShell's bundled Security module to avoid an inherited PowerShell 7
module-path conflict. No real credential contents were read by the agent for these
permission checks. Failure receipts contain only safe stage/error codes/SQLSTATE.

The full operations suite passed **151 tests**, including **14 private-helper
tests**. Actual provider-compatible activation, authenticated reader acceptance,
VM transfer, live backup/R2/alert/restore acceptance and timer enablement remain
pending. Do not infer any of those outcomes from the local tests or resume option.
The operator must perform the next credential submission privately; do not run the
normal command again, delete the protected directory, or blindly reset a password.

## Legacy retained-URL decoding corrected, 14 November 2026

The operator's next resume attempt stopped before activation. Read-only diagnostic
checks distinguished the exact cause: permissions and the environment-record
structure passed, URL parsing passed, but decoding its legacy password user-info
raised `URIError`. No password or URL contents were displayed, no password was
changed, and the original retained file was not written by the agent. This is an
old URL-encoding defect, not a PowerShell password-entry failure.

The revised resume flow first validates the retained target without decoding the
password. It then asks the operator to confirm the **original password** privately
and accepts it only if the current or exact legacy encoder reproduces the retained
connection. No malformed escape is guessed or silently normalized. After final
operator `ACTIVATE` only, a canonical `database-reviewed.env` can be created
exclusively, preserving the original file. The completion report names the verified
file for later transfer. Existing reviewed files stop the flow for reconciliation.

Regression cases cover invalid percent escapes, valid-but-ambiguous escapes,
original-password mismatches, foreign targets, and canonical connections. The
full operations suite passed **154 tests**, including **17 private-helper tests**.
Actual retained-file permissions/target/TLS checks and the live read-only inactive
role guard passed; no reviewed connection or success report exists yet. The agent
has not executed the interactive helper, submitted activation, or changed timers.
Private original-password confirmation is the next operator action; live
activation, authenticated reader acceptance and all later backup gates remain
pending.

## Private backup reader activation accepted, 14 November 2026

The operator reported `PRIVATE NEON SETUP COMPLETE`. The non-secret protected
completion report independently exists with timestamp 2026-11-14T09:24:43.336Z:
backup-reader login and its authenticated read-only check passed; no owner
credential was exported, ERP runtime configuration was unchanged, and the helper
did not enable timers. The verified local source is **`database-reviewed.env`**,
not the legacy `database.env`. Its existence and allowlisted filename were checked
without displaying its contents. Keep the original retained file unchanged.

Independent live metadata inspection in a read-only owner transaction passed at
2026-11-14T09:28:31.920Z: `school_erp_backup` is login-enabled, has the explicitly
approved RLS-bypass SELECT coverage and only `pg_read_all_data` membership, defaults
to read-only, and retains connection limit three. It has no administrator flags,
user-table write privileges, object ownership or schema/database CREATE privileges.
The ERP runtime remains login-enabled, non-superuser and without RLS bypass.
No credential, role grant or school data was changed by this inspection.

Accept only this private reader-activation/credential gate. VM credential transfer,
live backup and private R2 receipts, real isolated restore, delivered backup alerts,
timer activation/first timed run, separate-host recovery and overall production
readiness remain separate pending gates. Approval was requested before transferring
the verified backup credential to the root-only VM service configuration; no owner
URL or recovery key is included, and the API configuration will remain separate.
Earlier failed-setup entries are historical and do not override this later accepted
completion report.

## VM connection transfer awaiting operator upload, 14 November 2026

The operator approved copying only `database-reviewed.env` to the root-only VM
backup connection configuration. The SSH browser upload could not complete: its
file chooser became stale before upload submission. Do not mark the VM connection
or read-only preflight accepted. No owner connection or recovery key was uploaded.

At 2026-11-14T10:49:39.208866Z, the protected upload slot
`/home/ytech578/database-reviewed.env` was still empty and mode 0600. The final
`/etc/school-erp-neon-backup/database.env` remained a root-owned 0600 blank template.
Both Neon backup and monitor timers remained disabled and inactive. No backup,
restore, R2 upload, database credential change or API configuration change was made.
The next operator step is uploading only the reviewed file through SSH-in-browser;
then verify its private permissions before installing it and testing read-only.
The existing transfer approval does not enable timers or approve a real backup.

## VM connection and read-only preflight accepted, 14 November 2026

The operator uploaded the reviewed connection; SSH-in-browser renamed it to
`database-reviewed_(1).env` because the original transfer slot already existed.
The upload was mode 0664 inside the operator's private mode 0700 home directory.
Before reading its contents, it was secured as root-owned mode 0600. Validation
confirmed exactly one approved backup connection, the expected direct database
and `school_erp_backup` role, and verified TLS. No credential was displayed.

At 2026-11-14T11:01:48.541Z, the reviewed upload was moved atomically into
`/etc/school-erp-neon-backup/database.env`, retaining root:root 0600 permissions.
The old blank template was retained privately for rollback. No extra credential
copy remains under the renamed upload path; no owner connection or recovery key
was transferred. The API configuration was compared internally and is unchanged.

The installed worker and two supporting module hashes matched the reviewed local
sources. Its actual VM read-only preflight passed between
2026-11-14T11:04:29.923Z and 2026-11-14T11:04:32.121Z for **76 tables**, using the
dedicated backup reader and verified TLS. No dump/archive or backup-success status
was created. The source was read-only and all invocation-owned clients/plan were
cleaned up. This is not a real backup, R2 copy, or restore acceptance.

Final checks at 2026-11-14T11:05:44.237Z confirmed all five ERP/identity services
healthy, with their IDs/start times/restart counts unchanged across this operation.
The ERP login returned HTTPS 200; public OIDC discovery retained the expected
issuer and S256 PKCE. Both Neon backup and monitor timers remain disabled/inactive.
Non-secret evidence is stored locally in
`backups/onboarding/staging-neon-vm-connection-acceptance-20261114.json` and privately
on the VM at `/var/lib/school-erp-neon-backup/connection-acceptance-20261114.json`.

The connection gate is complete. A real encrypted backup, two full R2 GET checksum
receipts, alert acceptance, real isolated restore, timer activation and first
scheduled-run acceptance remain pending. Separate-host recovery and overall
production readiness are not established. Approval for one real backup/R2 test
has been requested separately; the connection-only approval does not start it.

## One live encrypted backup and R2 copy accepted, 14 November 2026

After separate operator approval, exactly one manual systemd service run completed
successfully from 2026-11-14T12:20:05.952Z to 2026-11-14T12:20:13.858Z (7.906 seconds).
It was not timer-triggered. Five installed worker/module hashes and the service
unit hash matched the reviewed sources. A one-shot attempt record prevents an
unknown outcome being blindly retried. No service/timer settings were changed.

The dedicated read-only backup reader exported all **76 tables** from a consistent
snapshot. The PostgreSQL 16 custom archive listing passed. Its authenticated
encrypted archive is `neon-1794658810289-66f56c45.enc` (2,236,927 bytes), root-owned
mode 0600. Authenticated decryption and manifest/bundle validation passed privately
on the VM; no school rows, plaintext dump, credential or recovery key was displayed.

The encrypted archive and 348-byte manifest were written under the existing private
R2 bucket's `neon-backups/school-erp-staging/` prefix. Both complete objects were
downloaded and their byte counts/SHA-256 checksums matched the local originals.
These are full GET receipts, not merely successful upload responses or HEAD checks.
Neither object previously existed. No recovery key/credential was uploaded, and
public access settings were not changed.

At 2026-11-14T12:24:06.708Z, all five ERP/identity services remained healthy with
their IDs, start times and restart counts unchanged. Public ERP login returned
HTTPS 200; OIDC discovery retained the expected issuer and S256 PKCE. No invocation
client plan, temporary client container or transfer directory remained. Both Neon
timers stayed disabled/inactive, and no automatic deletion was enabled. The source
database was read-only throughout. The systemd worker success and completion event
were correlated to invocation `5049c088c80647ffbb6a7fc450512ae6`.

Non-secret acceptance receipts are stored locally at
`backups/onboarding/staging-neon-live-backup-acceptance-20261114.json` and on the VM
at `/var/lib/school-erp-neon-backup/manual-backup-acceptance-20261114.json`.
This accepts the manual backup/encryption/R2 transport gate only. A real isolated
restore, Neon-specific delivered failure alert, timer activation and first scheduled
run remain pending. Archive-list validation is not a restore drill. A genuinely
separate recovery host is still unavailable; provider PITR, separate-host recovery
and overall production readiness are not established by this successful backup.

## Isolated real-data recovery procedure

`scripts/dr/isolated-neon-restore.js` adds a separate, explicitly confirmed
same-host recovery test. It never reads the source connection file or contacts
the live database. It downloads only the selected encrypted archive/manifest from
R2 using a ciphertext-only client. The recovery key is read by the VM host process
only; neither it nor a database credential is mounted or passed into a container.

The temporary PostgreSQL 16 server runs non-root, network-disabled and without
published ports, host-data mounts or persistent volumes. Its database is bounded
tmpfs, with host swap required off, a read-only root filesystem, dropped
capabilities, a one-GiB memory ceiling and a ten-minute independent cleanup timer.
The restore uses a new database named `neon_restore`, with one transaction and
stop-on-error semantics. It compares every table's row count and checksum against
the authenticated original snapshot inventory. Only aggregate success counts and
non-secret diagnostics may be recorded; no school rows or plaintext dump are saved.
The exact labelled disposable containers are reconciled and removed on success or
failure; encrypted downloaded copies and evidence remain privately for inspection.

Ownership/ACL restoration is intentionally disabled for this isolated data test.
It does **not** prove that production role grants, original ownership, application
login, a separate recovery host or provider PITR have been recovered. Those gates
must not be inferred from matching table checksums. The backup and monitor timers
are not enabled by this helper. The operator has approved the same-host drill,
but actual completion must be recorded separately after a real run passes.

Eight helper regression tests cover resource identity and cleanup bounds, disabled
network/ports, non-root execution, absence of source secrets/mounts, exact inventory
comparison and redacted failure categories. All **162 operations tests** passed
outside the restricted test sandbox; the sandbox-only failures were local socket,
temporary-file and Windows ACL restrictions, not skipped tests.

Live debugging also verified Docker's memory-only mounts through
`HostConfig.Tmpfs`, rather than requiring them in `Mounts`; the exact bounded mount
options remain mandatory. A regression test covers both representations and rejects
missing or changed mounts. Readiness now requires the final PID-1 PostgreSQL server
and a successful query to the exact temporary recovery database. This avoids
mistaking the image entrypoint's temporary initialization server for readiness.
Failed drill resources are reconciled with exact labels/images/mount restrictions,
not with a broad container cleanup. These implementation checks alone are not a
successful real restore; retain the actual drill result separately.

PostgreSQL warns that restoring a dump can execute code chosen by the source;
isolation is therefore required even for a verified archive. The recovery test uses
the documented [PostgreSQL 16 restore options](https://www.postgresql.org/docs/16/app-pgrestore.html)
and [Docker resource limits](https://docs.docker.com/engine/containers/resource_constraints/).

## Real isolated restore and delivered failure alerts accepted, 14 November 2026

After explicit operator approval, the selected real encrypted backup was downloaded
again from private R2, authenticated and restored into isolated PostgreSQL 16 on
the existing staging VM. The final successful run, `7307447639145307`, started at
2026-11-14T13:39:23.681Z and completed its data comparison at
2026-11-14T13:39:30.285Z. All **76 tables** matched the authenticated original
snapshot's row counts and checksums. No source database connection was made during
recovery, and no recovery key or source credential was passed into a container.

The temporary database had no network, public ports, host-data mounts or persistent
volume. It ran non-root with bounded tmpfs and host swap verified off. The exact
disposable containers were removed and all cleanup watchdog timers stopped.
Encrypted downloaded copies and private evidence were retained; the temporary
restored database was removed and can be recreated from the encrypted backup.

Two earlier failed drill attempts remain recorded rather than being treated as
successes. The first exposed Docker's tmpfs metadata representation; the second
returned a redacted restore-command failure whose original raw cause was not
retained. Exact mount checks and final-server readiness were hardened and
regression-tested before the final actual restore passed. No additional live
backup was made for these retries. Full operations tests passed **162/162**,
including **eight** isolated-recovery regression tests.

The operator confirmed the initial `NEON_TEST_ALERT_ONLY` email to
`ytech578@gmail.com`. Separately, a disposable failed systemd job (exit 23)
automatically triggered an isolated copy of the real Neon monitor through
`OnFailure`. SMTP accepted that distinct alert at 2026-11-14T13:44:25.553Z with
subject `ERP database backup requires attention: school-erp-staging-alert-drill`;
the operator confirmed inbox delivery. The fixture monitor's exit 1 was expected
because its synthetic backup status was unhealthy. Journal events independently
confirmed the failure/automatic trigger. A repeated check suppressed the duplicate
email and left both fixture and real backup statuses unchanged. No real backup
failure was induced and no school database connection was used by the alert drill.

Only the named temporary alert jobs were stopped. The completed transient job had
already been unloaded by systemd, so its historical result was reconciled from the
journal. The runtime test-handler definition was copied into private evidence and
byte-compared before its exact `/run` copy was removed; a rename cannot cross from
that tmpfs to the persistent evidence filesystem. No production unit was changed.

Final checks at **2026-11-14T13:56:04.148Z** confirmed five healthy live services,
ERP login HTTP 200, expected public OIDC issuer/S256 PKCE, healthy latest encrypted
backup, no temporary restore container or active cleanup watchdog, and no runtime
alert-test handler. Live service IDs/start times/restart counts and protected
configuration/backup status had remained unchanged across the restore. Both Neon
backup and monitor timers remain **disabled/inactive**, with no automatic deletion.

Non-secret results are recorded in
`backups/onboarding/staging-neon-restore-alert-acceptance-20261114.json` and privately
at `/var/lib/school-erp-neon-backup/restore-alert-acceptance-20261114.json` on the VM.
The local record is a normalized summary and records the final remote receipt hash;
it is not presented as a byte-identical copy. Earlier dated readiness entries are
historical; the latest acceptance gate supersedes their pending status only for
this scoped same-host data restore and delivered failure-alert chain.

**Remaining gates:** explicit timer-activation approval and the first actual
scheduled Neon run; original ownership/grants and restored-application access;
recovery using the independently stored key; a genuinely separate recovery host;
provider PITR/recovery objectives and overall production acceptance. This successful
same-host test does not establish those outcomes or authorize paid resources.

## Neon daily backup and hourly monitor activated, 14 November 2026

After explicit approval for both schedules with no automatic deletion, the existing
VM service passed a fresh preflight at 2026-11-14T17:53:06.489Z. All five reviewed
runtime/module hashes and four systemd-unit hashes matched, with no unit drop-ins
or pending daemon reload. Private-file permissions and the previous real restore
and delivered automatic failure-alert receipt passed. The latest encrypted backup
was healthy, and both Neon timers were initially disabled/inactive.

At **2026-11-14T17:54:02.680Z**, both exact timers were verified **enabled, active
and waiting** after activation:

- `school-erp-neon-backup.timer`: daily **02:00 Asia/Kolkata**. First run due
  **15 November 2026 at 02:00 IST** (14 November 20:30 UTC); no missed-run catch-up.
- `school-erp-neon-backup-monitor.timer`: hourly with up to 30 seconds randomized
  delay. First check due **14 November 2026 at 23:30:20 IST**; persistent monitoring.

No manual backup was triggered to stand in for scheduled-run evidence. No source
database connection, credential/configuration change, application restart, new paid
resource or deletion policy was introduced by activation. All five live services
remained healthy with unchanged IDs, start times and restart counts. The real Neon
backup status was byte-identical and healthy. The old workstation backup task was
not deactivated; retiring it requires separate acceptance and approval.

Activation evidence is retained locally in
`backups/onboarding/staging-neon-schedule-activation-20261114.json` and privately on
the VM at `/var/lib/school-erp-neon-backup/schedule-activation-20261114.json`.
The readiness summary now records the enabled VM schedules; earlier disabled-timer
entries describe historical stages, not the current activation state.

**At activation, first scheduled-run acceptance was pending** (accepted later below).
After the due time, correlate
the actual timer trigger, service invocation and successful exit with a new
authenticated encrypted archive and both full R2 GET checksum receipts. Verify the
monitor result, service health and lack of stale client plans. An enabled timer or
the earlier manual backup cannot establish that acceptance. Separate-host recovery,
original grants/ownership, restored-application access, independently stored key
recovery, provider PITR and overall production acceptance remain separate gates.

## First scheduled Neon backup accepted (17 November 2026 IST)

Read-only retrospective verification identified the first run due **15 November,
02:00 IST**. The journal start was `2026-11-14T20:30:00.020Z`, the authenticated
snapshot timestamp was `20:30:00.151Z`, and successful completion was
`20:30:09.127Z`, invocation `e026ee7b562b4f3991ea56c78dc8ea0d`. The approved
activation due time, timer/service relationship, journal and archive correlate;
the previous manual backup was not substituted.

The archive authenticated with 76 tables. Fresh GET-only R2 downloads matched
the full archive and manifest byte counts/SHA-256 values. The first scheduled
hourly monitor at `18:00:23.285Z` and the first post-backup monitor at
`21:00:31.013Z` both reported healthy. Both timers remained enabled/active, latest
backup health passed, no client plan remained, and all five live services and
three public HTTPS endpoints were healthy. No new backup, source database
connection, credential/key transfer, schedule change or automatic deletion was
performed by acceptance. The temporary ciphertext-only verifier was removed.

Evidence: `backups/onboarding/staging-neon-first-scheduled-run-20261115.json` and
VM `/var/lib/school-erp-neon-backup/first-scheduled-run-acceptance-20261117.json`.
This closes the first-timed-run gate, not full or separate-host recovery/PITR.
The read-only laptop assessment found only stopped Docker Desktop, no ordinary
Linux distribution and 1.93 GiB free RAM; no recovery was attempted there.
See `docs/production-readiness-2026-11-17.md` for the current remaining gates.

## Independent external monitoring accepted (17 November 2026 IST)

The owner restored GCP billing; the earlier monitoring billing blocker is historical.
Three Google-managed HTTPS checks and seven permanent policies are live. Both
Neon and identity backup health are published every five minutes; Google evaluates
unhealthy values and fifteen-minute signal absence independently of this VM.
All three disposable failure emails and all three recovery emails were confirmed
by the operator, the cloud incidents closed naturally, and the temporary check and
three temporary policies were removed without changing the permanent resources.
The existing backup schedules and no-automatic-deletion behavior were preserved.

See `docs/external-monitoring.md` and
`backups/onboarding/staging-external-monitoring-activation-20261116.json` for evidence.
This completes the external monitoring gate only; it does not satisfy the separate
scheduled-backup, full recovery, PITR or production gates above.

## Primary references

- [Neon pg_dump backups](https://neon.com/docs/manage/backup-pg-dump): use direct,
  unpooled connections and version-compatible PostgreSQL tooling.
- [Neon roles](https://neon.com/docs/manage/roles): console/API role creation may
  grant broad `neon_superuser` membership; verify actual privileges.
- [PostgreSQL 16 pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html): full
  exports must not silently turn into policy-filtered partial backups.
