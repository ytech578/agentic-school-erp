# Authentik offline backup and recovery

`scripts/dr/identity-recovery.js` backs up PostgreSQL, `/data`, `/templates`,
`/certs`, the original identity secret key and exact container image identities.
Unknown mounts fail the backup instead of silently omitting persistent data.
Extend the inventory before adding blueprints, external storage or different mounts.

Stop the identity server and worker for a consistent file/database backup. The
tool briefly starts only the source identity database if needed and restores its
original stopped state afterward. Production needs an approved maintenance window.

The whole bundle, including its secret key and integrity metadata, is authenticated
and encrypted with AES-256-GCM. Keep the recovery encryption key separately under
an identified custodian. The current development key and archive are on this
laptop, so this is not an independent disaster-recovery copy. Windows file ACLs
must be managed by the operator; Node file modes alone are not an ACL policy.

## Commands

Use an absolute protected `IDENTITY_BACKUP_KEY_FILE`. The generated local test key
is in ignored `backups/identity-keys/recovery.key`; never replace an existing key.
The initializer fails if the file already exists. Choose a different key per
production installation and keep a separate secure recovery copy.

```powershell
$env:IDENTITY_BACKUP_KEY_FILE = 'D:\Agentic School ERP V1.0\backups\identity-keys\recovery.key'
# NEW installation only, after creating a protected parent directory:
node scripts/dr/identity-recovery.js init-key

# Defaults to school-erp-identity; override IDENTITY_COMPOSE_PROJECT explicitly
# for a different approved source installation.
npm run identity:backup
npm run identity:backup:verify -- <exact-encrypted-archive>
npm run identity:restore:drill -- <exact-encrypted-archive>

# Existing local synthetic fixture only; needs at least 2 GiB host memory free:
npm run identity:restore:drill -- <exact-encrypted-archive> --synthetic-login
```

Verification authenticates the archive and its entries; it does not perform a
restore. The drill restores to a newly named, 256 MiB-capped PostgreSQL container
with network disabled and no host ports. It compares logical schema/data using
the same database image, excluding only random pg_dump restrict markers.

New file volumes are checked by path, contents, type, permissions, numeric owner
and link destination. Archive ordering, user-name aliases and timestamps are not
acceptance criteria. Entry paths/types and symlink write-through are validated
before extraction. Leaf compatibility symlinks are preserved without following.
Numeric ownership is explicitly restored, including volume roots and symlinks.

The optional local login check mounts recovered volumes, uses the recovered key
and briefly starts one 1 GiB-capped restored server in the database's network-
disabled namespace. Password + existing TOTP, missing-MFA denial and authenticated
session acceptance run over loopback HTTP inside that namespace. No host port
opens; no worker/SCIM/SMTP integration can connect. This does not repeat an ERP
OIDC callback or browser/TLS acceptance.

Only invocation-owned disposable drill containers/volumes are removed. Backups
and source volumes remain. Cleanup failure fails the run and identifies its drill
label. No source database is overwritten. For a new recovery host, retrieve the
recorded exact registry image digests separately before running the drill.

Successful runs write sanitized `.drill-<timestamp>.json` evidence beside the
archive. Reports distinguish runtime login verification and production acceptance.

## Verified locally on 2026-10-20

Encrypted archive authentication, restored schema/data, all three volumes,
original secret key, existing password/TOTP login, missing-MFA denial, network
isolation and disposable-resource cleanup passed. The final drill took 36 seconds.
Evidence is in ignored `backups/identity-recovery`; production remains unaccepted.

## Operational limits

The local tool holds bounded archives in memory and rejects bundles above 128 MiB.
It supports simple ustar archives from the supplied layout, not arbitrary PAX/GNU
extensions or device files. Larger installations need a streaming backup service.
No scheduler, off-host upload, retention deletion or external monitoring is created.
Production also needs independent key custody, an approved backup destination,
second-host recovery and measured recovery/data-loss objectives. Reconnect one
worker only after real-school TLS, MFA/OIDC and recovery access pass acceptance.

Vendor reference: https://docs.goauthentik.io/sys-mgmt/ops/backup-restore/
