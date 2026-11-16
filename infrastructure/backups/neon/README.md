# Separate Neon ERP backup service

This Linux-only service is independent of the running ERP API and Authentik.
It reads a complete database snapshot without pausing either application, encrypts
the dump and per-table verification inventory, and uploads only ciphertext plus a
strict non-secret manifest to private R2. It does not provide WAL/PITR or back up
uploaded documents. PostgreSQL global roles are not included in a single-database
dump; recreate approved runtime/security roles separately during recovery.

## Approved staging schedule and access boundary

- Daily 02:00 Asia/Kolkata; hourly health/failure check; no automatic deletion.
- Separate root-owned configuration, key, state and code. No owner or backup
  credentials are added to `application.env`, the API container, or its image.
- Direct, exact-host/database/user connection; TLS `verify-full`. Backup credential
  must have full RLS-bypass SELECT access without administrator or write privileges.
- `school_erp_backup` creation requires **separate explicit approval** for
  `BYPASSRLS` and `pg_read_all_data`. No role has been provisioned by installation.
  Do not grant `neon_superuser`, use an owner URL as fallback, or weaken runtime RLS.
- Timers remain disabled until credential, independent key custody, a real manual
  backup/R2 verification, delivered alerts and isolated restore acceptance pass.

## Installation

Review `config.example.json`, substituting the known source hostname and immutable
image IDs. Use the approved vendor Node binary already verified on the host.
The installer refuses existing paths, generates a distinct recovery key without
printing it, copies only allowlisted R2 settings into the new private configuration,
and never connects to Neon, starts a backup or enables timers:

```sh
sudo /opt/school-erp-backup/node scripts/dr/install-neon-backup-service.js /private/reviewed-config.json /opt/school-erp-backup/node /private/existing-storage.env
```

Installation paths:

- `/opt/school-erp-neon-backup`: root-protected code and runtime.
- `/etc/school-erp-neon-backup/database.env`: operator-supplied
  `NEON_BACKUP_DATABASE_URL`, never the application or owner connection.
- `/etc/school-erp-neon-backup/recovery.key`: distinct AES key, root 0600.
- `/etc/school-erp-neon-backup/storage.env`: allowlisted R2 configuration, root 0600.
- `/var/lib/school-erp-neon-backup`: private ciphertext archives, receipts and lock.

Never print a filled environment file/key or pass passwords in commands or chat.
After exact reader-grant approval, the local guarded provisioner
`scripts/db/prepare-neon-backup-role.js` can create only an inactive `NOLOGIN` reader
in a transaction; it does not set a password. Provider refusal rolls back rather
than enabling a broader role. The operator must privately set a new password and
enable its login after effective permission review. Keep an independently protected
copy of the new recovery key before relying on cloud backups. Preserve the ERP's
PII encryption and MFA keys separately too; a database dump alone cannot replace them.

### Private operator password handoff

The approved inactive `school_erp_backup` role now exists. Password setup is an
operator-only action. In an interactive local PowerShell window, from the project
root, run:

```powershell
node scripts/dr/private-neon-backup-setup.js
```

Save a fresh random ASCII password of 32–128 characters in a password manager.
The helper prompts twice without echoing inputs or accepting password arguments,
then requires the operator to type `ACTIVATE` for the final password/login change.
After a valid paste it reports only the character count, never the password.
An empty/invalid entry or mismatched confirmation produces a specific safe message
and allows up to three attempts inside the helper. Use the terminal's Paste action
(right-click in Windows PowerShell if a keyboard shortcut does not paste). Copy
only the saved password, without its label, spaces or wrapping quotes. Type
`ACTIVATE` only when the helper explicitly asks; it is not a PowerShell command.
If the helper returns to `PS ...>`, it is no longer waiting for activation.
It refuses already active or broadened roles and retains strict TLS certificate
validation. Neon requires the original password rather than a client-generated
SCRAM/MD5 hash. The operator-only helper submits a safely escaped password literal
over the strictly validated TLS connection, and Neon encrypts it for storage.
The password therefore exists in the submitted SQL, but SQL/raw exception logging
is disabled in this helper; no password or complete connection URL is printed.
See [Neon's password requirements](https://neon.com/docs/manage/roles#manage-roles-with-sql).

The helper creates an exclusive private directory with inheritance disabled and
access limited to the current Windows user and SYSTEM (0700 on Linux), then stores
only the backup-role connection in
`backups/onboarding/neon-private-credentials/database.env`. Never open or paste
this file into chat. Owner credentials are not exported. A successful authenticated
read-only role check creates a non-secret `setup-result.json` in the same directory.
If activation has an unknown outcome, the helper retains the private connection
file and stops for operator review rather than automatically rotating a password.
It does not copy the file to the VM, run a backup, change the ERP or enable timers.

#### Reviewed resume after a failed activation

The normal command deliberately refuses existing private setup files. Do not
delete that directory or reset the password to bypass the guard. After read-only
review confirms the role is still inactive with the approved privileges, the
operator may explicitly run:

```powershell
node scripts/dr/private-neon-backup-setup.js --resume-inactive-setup
```

This mode verifies protected ownership/permissions, rejects links, active roles,
unexpected targets/settings, and existing completion reports. It asks the operator
to paste the **original saved password** twice, not generate a new password. The
entered value must reproduce the retained connection under either the current
encoder or the exact legacy encoder. This avoids guessing malformed percent
escapes or silently interpreting a literal `%41` as `A`. Contents stay hidden.
The operator must still type `ACTIVATE` privately at the final prompt.

If the legacy representation needs correction, after that explicit confirmation
the helper creates **`database-reviewed.env`** exclusively in the same protected
directory and leaves `database.env` untouched. A pre-existing reviewed file stops
the flow for reconciliation; it is never overwritten. On success the non-secret
`setup-result.json` records `connectionFile`; transfer only that named verified
file to the VM's fixed `/etc/school-erp-neon-backup/database.env` destination.
Do not upload the uncorrected legacy file or either recovery key. Cancelled
confirmation does not create or replace a connection file.

This is an explicitly reviewed resume, not an
automatic retry of an unknown write outcome. Resume cancellation/preflight errors
never remove the existing credential. On a further failure, a private
`setup-review-*.json` record contains only a safe stage/error code and SQLSTATE,
never the raw exception, SQL or credential. Reconcile read-only again rather than
blindly rerunning. Local tests do not establish actual Neon activation acceptance.

For this staging setup, a private operator-readable copy of the distinct Neon key
was prepared at
`/home/ytech578/school-erp-secrets/neon-backup-transfer-20261112/neon-staging-recovery-20261112.key`.
It has 0600 permissions inside a 0700 directory and was compared with the root key
internally, without displaying or hashing key material. Download it privately using
Google SSH-in-browser, keep it outside the VM in protected storage separate from R2,
and confirm custody without sending its contents. No independent copy is accepted
until the operator confirms it; the prior Authentik key is not this key.

## Validation and activation gates

1. Run the operations suite and the explicit `verify-neon-snapshot-fixture.js`
   with a pinned PostgreSQL 16 image. It uses only synthetic data in a disposable,
   network-isolated cluster; verifies both synthetic schools, a concurrent write,
   extra user schema, full restored table counts/checksums, and RLS-filtered-role
   rejection; then removes only its own container. No live source is connected.
2. With the real dedicated credential configured privately and the key independently
   retained, run `scheduled-neon-backup.js preflight /etc/school-erp-neon-backup/config.json`
   as root using the installed Node. It reads all user-schema tables in a repeatable
   read-only transaction and checks RLS bypass, database identity, select coverage,
   absence of ownership/write/admin permissions and compatible tooling. It does
   not produce a backup, upload to R2 or enable timers.
3. Obtain approval for a real bounded export and private R2 transfer, then run
   `systemctl start school-erp-neon-backup.service`. Require exit zero and a fresh
   successful status with authenticated archive, dump-list validation and full GET
   checksum receipts for both R2 objects. Archive verification alone is not a restore.
4. Arrange a separately approved isolated restore of that real archive, matching
   every user table's count and checksum. Never restore into the live source.
   Test alert delivery and the synthetic failure path without changing live secrets.
5. Only after these gates pass, enable the two Neon timers and verify the first
   timed run separately. The installer does **not** do this. Retain the Windows
   backup task until its replacement and deactivation are explicitly approved.

## Recovery and operational limits

The snapshot, dump and dump-list clients are independent, bounded containers.
They have no Docker socket, host data mount or published port; image data volumes
are replaced with tiny volatile mounts. Local dump verification has no network.
`ExecStopPost` cleanup validates an invocation-bound plan, exact IDs/labels/image,
and absence of persistent mounts/ports before removing any client. An old cleanup
cannot consume a new invocation's plan. A stale plan stops another run for review.
The source application or identity containers are never stop/cleanup targets.

This initial implementation fails closed above **64 MiB compressed pg_dump** or
**96 MiB encrypted-bundle capacity**. Plan a reviewed streaming implementation
before approaching these limits; no data is silently omitted. Tables use MD5 row
fingerprints for restore comparison, while AES-256-GCM and SHA-256 authenticate
and verify the archive. Sequence values are PostgreSQL's normal non-MVCC dump
behavior, not an independently snapshot-verified business counter. Long reads can
consume Neon compute and read load; this is not a zero-impact or zero-cost guarantee.

The hourly checker validates age (26h), local hashes and the last full remote GET
receipts, with six-hour cooldown only after accepted SMTP. It does not continuously
re-download R2 objects or guarantee inbox delivery. On-source monitoring cannot
report VM/Docker failure independently; external monitoring remains necessary.

No production readiness, cross-region or second-host recovery is implied by these
files, synthetic checks, disabled installation or manual archive authentication.
