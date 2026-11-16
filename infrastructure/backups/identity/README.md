# Scheduled encrypted identity backups (Linux host)

Scope: Authentik's database, original encryption secret and all three identity
volumes. This does **not** replace the separate Neon ERP database backup or provide
Neon WAL/PITR. No AWS resources or new paid hosts are created by this package.

## Agreed staging policy

- Daily **03:00 Asia/Kolkata**, no random maintenance delay.
- Authentik server/worker pause briefly for a consistent snapshot; ERP API/web and
  identity PostgreSQL stay running. Existing ERP sessions are not deliberately revoked.
- No local/R2 archive deletion or lifecycle policy is installed. Monitor disk/R2
  use; agree retention separately before any deletion.
- Missed runs do not catch up with an unexpected daytime sign-in pause. An hourly
  check detects absent/stale (>26h), corrupt or unsuccessfully copied backups.
- Failure alerts go to the operator-approved recipient via privately configured
  SMTP. Test SMTP acceptance **and operator-confirmed inbox delivery** separately.
- **A monitor on this VM cannot notify when the VM itself is down.** A separately
  hosted dead-man/uptime monitor remains required for production acceptance.

## Installation and activation gates

Use an operator-reviewed source release and the previously checksum-verified
vendor Node binary. The root service controls Docker, so keep its installed code,
binary, configuration and all parent directories root-owned and non-writable by
ordinary accounts. Never mount Docker's socket into the ERP API.

1. Review `config.example.json` against the intended VM. The dependency image must
   be an already present immutable **image ID**, with S3 SDK and nodemailer
   installed. It is used in a separate constrained container, not the running API.
2. Run the installer as root, supplying absolute paths to the reviewed configuration
   and verified vendor Node binary:

   ```sh
   sudo /absolute/path/to/verified/node scripts/dr/install-identity-backup-service.js /absolute/path/to/reviewed-config.json /absolute/path/to/verified/node
   ```

   It refuses existing installations and never enables timers, sends messages,
   creates keys, starts a backup or stops Authentik. A partial failed installation
   must be inspected, not blindly retried or recursively removed.
3. Privately edit `/etc/school-erp-backup/alerts.env` as root (0600). Set the approved
   recipient and the real sender account/provider. Use a dedicated SMTP/app password,
   **not your normal login password**. Never paste it into chat, Git or a shell
   command. Supported ports: 587 with mandatory STARTTLS, or 465 with TLS.
4. Send a test alert from the host tool; it contains only a project name and
   `TEST_ALERT_ONLY`, never school records/keys. Confirm its arrival in the intended
   inbox, including spam handling:

   ```sh
   sudo /opt/school-erp-backup/node /opt/school-erp-backup/scripts/dr/scheduled-identity-backup.js test-alert /etc/school-erp-backup/config.json
   ```

5. Obtain approval for an **immediate** maintenance test (future daily maintenance
   approval alone does not authorize an unexpected daytime sign-in interruption).
   Run `sudo systemctl start school-erp-identity-backup.service`. Validate private
   status, both R2 GET checksums, live identity health, public discovery, and normal
   login after resume. Check a synthetic failure alert without breaking live R2
   credentials, filling the disk, or stopping live Docker.
6. Only after these gates pass, activate both timers:

   ```sh
   sudo systemctl enable --now school-erp-identity-backup.timer school-erp-identity-backup-monitor.timer
   sudo systemctl list-timers --all school-erp-identity-backup.timer school-erp-identity-backup-monitor.timer
   ```

   Confirm the first scheduled run and its remote receipt separately. No enablement
   is implied merely by installation or passing synthetic tests.

## Safety and failure recovery

The service records exact container IDs/project/service labels and only accepts
already running/healthy source services. A separate six-minute systemd watchdog
is registered **before** stopping worker/server. Normal and failed backup paths
resume both before transport work; a killed process leaves the independent resume
watchdog armed. A failed resume never disarms it. Inspect failures urgently; this
does not protect against a dead Docker daemon, VM failure or broken source data.
Each watchdog is bound to the exact invocation's resume-plan fingerprint; a delayed
old watchdog cannot resume a newer backup. Concurrent successful resumes tolerate
an already consumed identical plan but never delete a replacement plan.

The primary service times out in ten minutes and serializes with the health check
using a host lock. No automatic maintenance retry is configured. An unconsumed
resume plan stops the next run rather than guessing which services to start.
After reviewing a failure, use the `resume` mode with the same root-owned config
to consume the exact recorded plan; do not start an entire Compose stack blindly.

Backups remain bounded to the existing tool's **128 MiB plaintext archive limit**;
outgrowing it fails/alerts rather than silently dropping files. Migrate to a reviewed
streaming backup implementation before approaching that size.

The only uploaded objects are AES-256-GCM ciphertext and its strict non-secret
manifest under `identity-backups/<project>/`. Each is read back and fully hashed;
unknown write outcomes are reconciled by exact key, never overwrite/delete. The
recovery key and SMTP credentials never enter the transport container. R2 bucket
credentials use an environment allowlist, no application/Neon-owner configuration.

## Second-host drill (still requires a separate approved machine)

Another container on the source VM is **not** sufficient. Prepare a Linux host
with Docker, systemd, supported Node, at least 2 GiB available for data-only restore, and
the exact recorded PostgreSQL image. For a later operator login window, allow at
least 3 GiB available and the recorded Authentik image as well. Do not create a paid
VM, widen access or place a decryption key in Cloud Shell without explicit approval.

1. On the source VM, capture the non-secret host/daemon fingerprint proof:

   ```sh
   IDENTITY_COMPOSE_PROJECT=school-erp-staging /opt/school-erp-backup/node /opt/school-erp-backup/scripts/dr/second-host-identity-drill.js source-proof
   ```

   Save that JSON privately with the encrypted archive/manifest. Retain its checksum
   through the authenticated operator channel; do not substitute an arbitrary proof.
2. Download **only** the approved ciphertext and manifest from private R2 onto the
   second host (read-only scoped credentials preferred), verifying both full hashes
   against the source receipt. `identity-backup-transport.js download <project>
   <archive-basename>` supports an isolated `/transfer` output directory; no key is
   downloaded, and existing files are never overwritten. Transfer the recovery key
   separately and privately with 0600 permissions, then unset transfer credentials.
3. Copy reviewed recovery scripts and resolve the recorded immutable image IDs
   using their vendor digest references. Do not replace missing images with `latest`.
4. Run preflight with absolute archive/proof paths; it refuses the same machine or
   same Docker daemon and reads no decryption key:

   ```sh
   node scripts/dr/second-host-identity-drill.js preflight /private/identity-ARCHIVE.enc /private/source-proof.json
   ```

5. With the isolated disposable drill approved, set `IDENTITY_BACKUP_KEY_FILE` to
   the **path** of the privately supplied key and run `drill` with the same paths and
   `--confirm-isolated` as root, using a root-owned reviewed script release. A
   separate twenty-minute cleanup watchdog must be armed before creating resources.
   The tool authenticates/decrypts, compares restored logical
   schema/data and every volume file/ownership/mode, blocks outbound networking,
   publishes no ports, starts no worker and removes only invocation-owned resources.
   Retain the resulting report, evidence of R2 download and separately held key use.
6. A successful data-only report does not claim a second-host password/MFA browser
   login, measured full disaster RTO, cross-region placement, or overall production
   readiness. Arrange a separately approved bounded operator window for that test.

Never overwrite live ERP/Authentik data, promote a restored clone, or point ERP
OIDC at a restored copy as part of this drill. No automatic schedule or second-host
acceptance is claimed until its observed evidence exists.
