# Controlled Neon and single-VM staging cutover

## Current boundary

The owner approved a controlled live cutover on 2026-11-07. Approval is not proof
that its operational prerequisites have been met. Execution status is recorded
in the private `cutover.json` and its authenticated checkpoint, not inferred from
this guide. Never substitute keys from an unrelated local rehearsal. The
preflight is read-only and has no apply flag:

```powershell
npm run security:neon:preflight
```

It verifies the dedicated ERP endpoint/database, operator/runtime separation,
the current encryption and signing settings, stored encrypted fields, unfinished
migrations, restricted runtime role and denied unscoped tenant reads. It reports
existing runtime connections but does not terminate them or change permissions.
It does not assert production readiness or independently prove backup custody.

## Prepared controlled-live workflow

The separate `security:neon:cutover` command has explicit `prepare`, `rehearse`,
`apply`, `rollback`, and `release` modes. It is not the local-only migration
command and has no automatic apply default. Preparation verifies the encrypted
backup and matching manifest against the independent VM copy receipt, compares
all source-table checksums, and creates an authenticated encrypted checkpoint.
The checkpoint retains the original configuration, paired replacement settings,
and the exact cloud runtime file. Never regenerate these keys during a retry.

The exact staged keys have been exercised on a fresh local restore: commit the
rotation, verify the enrolled MFA seed and both recovery-code peppers, and
restore the original ciphertext. Audit records from this rehearsal remain
append-only in the disposable local database. No live records are changed by
preparation or rehearsal.

Apply requires a fresh VM readiness receipt, stopped local API, unchanged source
data/configuration, and explicit maintenance acknowledgement. It fences only the
ERP runtime role with `NOLOGIN`, terminates only same-database runtime sessions,
and refuses other active ERP operator connections. The serialized transaction
authenticates the old ciphertext, durably encrypts a rollback journal before
commit, and preserves business invariants and historical audit records. Matching
local configuration is then activated while the runtime remains fenced.

Release is separate: the VM file hash, successful production dependency scan,
combined Compose validation, image builds, storage connection, and stopped
services must still match the receipt. Ciphertext and active configuration are
checked again before runtime login is restored. A refusal or crash is not a
reason to restart an application or replace keys by hand. Inspect the private
state/checkpoint and use paired rollback if necessary. Rollback intentionally
retains the runtime fence until an operator verifies the original deployment.

The encrypted database archive and its manifest are stored privately on the GCP
staging VM, with the backup decryption key kept off that VM. This is an
independent rollback copy, not completed cross-region DR or scheduled PITR.

## Gates before any live encryption change

1. Retain a fresh authenticated encrypted database archive. Copy it to a genuinely
   independent approved destination, verify that copy, and retain its decryption
   key separately. Same-laptop folders are not independent recovery.
2. Establish authenticated VM access, verify available memory/disk, repository
   contents, private R2 configuration, certificate ownership, and rollback access.
   Do not transmit passwords/private keys through chat or commit environment files.
3. Build/review the target application, including previous-pepper verification,
   before stopping the currently running ERP. Stage new configuration privately.
4. Stop all ERP APIs, workers, schedulers and other writers to this database,
   including the laptop API. Keep them stopped through migration and verification.
   Do not merely stop the frontend or assume an advisory lock blocks application writes.
5. Implement and review a separate explicitly targeted live transaction with an
   authenticated encrypted rollback journal and durable configuration staging.
   Rehearse its commit, failure and paired rollback against a fresh local restore.
   The local-only tool intentionally cannot target Neon; do not bypass its guard.
6. Migrate encrypted fields atomically without resetting passwords, MFA seeds or
   recovery-code arrays. Preserve the old recovery pepper for verification.
   Change database ciphertext and all active process configurations as one
   maintenance operation. Retain previous configuration securely for rollback.
7. Verify stored data, MFA and recovery-code behavior before reopening traffic.
   If a check fails, leave maintenance in place. A coordinated rollback restores
   both ciphertext and configuration; reverting the key file alone breaks login.

Do not begin step 6 while VM access, independent backup, live migration/rollback
implementation or quiescence is unverified. Preflight and source packaging do
not perform live changes; the separately acknowledged cutover command does.

### Verified staging execution: 2026-11-07

The exact-key local commit/rollback rehearsal, independent encrypted backup copy,
patched application builds and private VM configuration checks passed before
the live transaction. The controlled transaction rekeyed one encrypted MFA field
without resetting passwords, MFA enrollment or recovery-code arrays, preserving
1,068 users and the enrolled MFA account. The paired local configuration was
activated, and the runtime role was explicitly released after verification.
Read-only post-cutover checks authenticated the migrated field and confirmed the
restricted role and denied unscoped tenant reads across the 76-table database.

Both patched application images and all private supporting services started
successfully on the GCP staging VM. The actual malware scanner accepted harmless
clean data, detected the harmless antivirus test signature, and failed closed
when unavailable; these checks created no school documents or storage objects.
Identity publication remains disabled. With separate owner approval, the staging
ERP was published at `https://staging.agenticschoolos.in`. Public login and API
health returned 200, unauthenticated student access returned 401, raw upload
paths returned 404, and the unpublished identity hostname returned 503. The real
login screen was observed over HTTPS without bypassing certificate validation.
The former TLS placeholder container was stopped and retained for fallback.
The operator entered the password and authenticator code privately and reported
that the dashboard opened. On the follow-up check, the authenticated `/dashboard`
route and administrator dashboard heading were independently observed. Reloading
the page retained the authenticated dashboard. This accepts the password/MFA login
and immediate reload persistence only; it does not prove long-term session expiry
or logout/revocation. No account settings or session credentials were changed by
the verifier. Broader role, federation and recovery acceptance remain separate
gates; do not infer production acceptance from this execution record.

## Single-VM HTTPS layout

The new staging overlay joins ERP and the existing isolated identity services on
one Compose network. One non-root read-only nginx handles both approved hostnames;
there is no second identity proxy competing for port 443. API, Redis, identity
HTTP and identity PostgreSQL have no published ports. The local ERP PostgreSQL
and PgBouncer remain behind the on-premises-only profile and are not started.

Compose file order (from the repository root) is:

```text
docker-compose.yml
infrastructure/deploy/cloud.compose.yml
infrastructure/authentik/compose.yml
infrastructure/deploy/staging.compose.yml
```

Do not add `infrastructure/authentik/production.compose.yml` to this layout.
Use the production identity base images, never development overlays or test
bootstrap secrets. New identity volumes are NOT configured school federation.
`AUTHENTIK_PUBLIC_ENABLED` defaults to `0`, returning HTTPS 503 on the identity
hostname. Complete administrator provisioning over a private operator path and
verify the exact school/provider binding before explicitly publishing identity
with `AUTHENTIK_PUBLIC_ENABLED=1`. Do not expose a fresh initial-setup flow to
the public Internet just to test container health.

Operator environment inputs, stored outside Git with mode 0600, include:

| Input | Meaning |
| --- | --- |
| `ERP_DOMAIN` | `staging.agenticschoolos.in` |
| `AUTHENTIK_DOMAIN` | `auth-staging.agenticschoolos.in` |
| `ORIGIN_TLS_DIRECTORY` | Absolute VM path to the private origin certificate directory |
| `TLS_READER_UID`, `TLS_READER_GID` | Numeric UID/GID of that directory/file owner; preserve 0700/0600 permissions |
| `DATABASE_URL` | Restricted RLS runtime URL, never the Neon owner URL |
| `PII_ENCRYPTION_KEY`, MFA peppers | Only configuration coordinated with the live database cutover |
| JWT secrets | Preserve the current application signing secrets during this operation |
| Redis password | Dedicated strong cache secret |
| S3 values | Existing private R2 bucket-scoped credentials; never TLS keys |
| Authentik DB password/key | Newly generated production identity secrets, not development secrets |

Keep domain values to the exact approved DNS names, without schemes, slashes or
configuration text. Both names must be present in the origin certificate. The
Cloudflare proxy and Full (strict) mode must remain enabled: Cloudflare Origin CA
is for Cloudflare-to-origin TLS, not direct browser trust. See
[Cloudflare Origin CA documentation](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/).

`NEXT_PUBLIC_API_URL` is explicitly supplied at image build time as
`https://<ERP_DOMAIN>/api/v1`; a runtime-only environment change cannot repair an
already built Next.js browser bundle. SSR uses `http://api:4000/api/v1` privately.
The ingress preserves `/api/v1` without adding a second version prefix, never
serves uploads directly, avoids SSO query-string logs and disables authenticated
response caching. Unknown TLS names are rejected.

The local proxy acceptance harness uses two newly named synthetic nginx
containers, a one-day test certificate and a localhost-only random port. It does
not start ERP/Authentik or use school credentials. It verifies TLS trust, syntax,
routing, cache/security headers, upload denial and unknown-name rejection, then
removes only its own temporary containers/network. Private test artifacts remain
under the ignored backup directory. With a pre-existing pinned nginx image and
OpenSSL available, run:

```text
npm run ops:staging:verify -- --openssl <path-to-openssl>
```

This is a routing test, not a live deployment or browser login acceptance.
The Docker build context now excludes backups, document uploads, TLS keys and
operator secret files, in addition to the existing environment-file exclusions.

Validate privately with `docker compose ... config --quiet`, not plain `config`
which prints secrets. Build images sequentially while application services are
not running. Do not stop the temporary `school-erp-tls-check` container until
the target images/configuration and rollback are ready; stop it before binding
the new proxy to 443. Retain it for rollback rather than deleting it immediately.

The 8 GB VM is a staging capacity to measure, not enterprise availability or
performance acceptance. Memory limits are safeguards, not an allocation guarantee.
Monitor signature loading/reloading, identity workers, build peaks and OOM events.
Do not disable malware scanning or MFA to make an undersized host start. Redis
uses `noeviction` so queue/session coordination is not silently evicted.

## Private identity bootstrap prepared: 2026-11-08

The operator authorized a 30-minute private setup tunnel after personally
authorizing Cloud Shell. The VM and identity services were healthy, with about
4.8 GiB available memory. A new expiring key was registered only in the existing
VM user's SSH authorization file, preserving other entries. Its options deny
interactive commands and restrict local forwarding to the private identity
endpoint. No project-wide SSH metadata, IAM permissions, firewall, identity
public switch, or school accounts were changed.

The initial direct Cloud Shell preview exposed an HTTPS/HTTP scheme mismatch:
Authentik generated an HTTP API origin for a browser using HTTPS. Correct HTTPS
forwarding was confirmed against the private API. A bounded loopback-only adapter
preserves flow/session cookies and WebSockets while overwriting the trusted
forwarding scheme and preview hostname. It logs no requests or credentials and
does not disable CSRF, certificate checks, MFA or browser protections. The setup
must start at the preview root `/`; directly entering the flow path can be denied
by the initial-setup entry guard.

The administrator email/password form was observed working, with the stable
identity URL prefilled. The operator must enter and submit the new credentials
privately. Administrator initialization, identity MFA and school federation are
NOT yet accepted merely because this form is ready. The public identity hostname
still returned 503, and the VM exposed no identity HTTP/HTTPS port.

At the follow-up on 9 November (IST), the operator confirmed administrator
creation. The authenticated account settings and administrator-interface link
were independently observed without reading passwords or authenticator secrets.
The credential-device list showed no MFA devices. The Enroll menu was opened to
hand off TOTP enrollment privately, stopping before the QR code or seed appears.
Administrator initialization is accepted; identity MFA, recovery and federation
remain unaccepted until their separate checks pass.

The operator subsequently confirmed TOTP enrollment. One TOTP device was
independently observed in the administrator's device list without opening its QR
code, seed or editor. The sign-out menu was opened for a fresh login handoff;
the verifier did not sign out or revoke the session. The operator then confirmed
that password-plus-TOTP login passed. The authenticated library and administrator
interface link were independently observed after that report. This accepts the
private administrator's successful password/TOTP path only, not school SSO,
negative-MFA tests, other users' policy enforcement, recovery or break-glass.

The temporary SSH key and the active tunnel/adapter cutoff are
`2026-11-08T18:43:21Z` (9 November, 00:13 IST). The key's authentication expiry
does not by itself end an established SSH session, so the processes also have an
independent hard cutoff. Do not extend the window without renewed operator
approval. Keep the Cloud Shell session open during the handoff; after expiry,
re-establish the private path rather than publishing an unfinished setup page.

After the approved cutoff, a read-only check in the same Cloud Shell instance
reported no listeners on private setup ports 8080, 8082 or 18080 at
`2026-11-08T18:45:31Z`. The public identity hostname still returned 503 and the
VM had no identity host port. Access was not extended. The cached browser page
can remain visible after closure; further live setup needs a newly approved
private window, not a password/MFA reset or public initial-setup exposure.

The later private recovery follow-up on 9 November accepted this administrator's
operator-performed recovery-code login, reported rejection of that same used
code, and subsequent normal TOTP login. The authenticated library and
administrator-interface link were independently observed afterward; the verifier
did not capture credentials or the negative challenge. See
`docs/identity-recovery.md` and the private verification-window report for the
bounded evidence. This does not accept school SSO/SCIM, an independently held
recovery administrator, tenant-wide MFA policy or production recovery. The latest
approved private window still ends at `2026-11-08T19:59:53Z`; it is not extended
by successful tests or a request to continue other work.

## Runtime dependency maintenance

The container and CI runtime uses Node 26 LTS rather than end-of-life Node 20.
Next.js and its ESLint configuration are aligned on 16.4.5. NestJS runtime
packages stay on the compatible 11.2.x line; a narrow root override supplies
Multer 2.5.x to `@nestjs/platform-express`, whose 11.2.8 manifest still pins
Multer 2.4.0. Keep this override until upstream supplies a patched upload parser,
and verify upload regression tests before removing it. The security lockfile
also updates compatible parser, redirect, and system-information dependencies.
Do not use `npm audit fix --force` to silently introduce framework major changes.
Scan production dependencies separately from development tooling, and record
remaining development-only findings rather than declaring all dependencies clear.

Patch references: [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw),
[Multer advisory](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m),
[Node release schedule](https://nodejs.org/en/about/previous-releases).

Origin firewall/CDN trust, rate-limit client identity, independent backups,
scheduled cloud recovery, operator alerts and identity federation remain separate
deployment checks. This package does not create paid resources or change firewalls.

## Browser acceptance after deployment

- Verify HTTPS/login on the approved ERP hostname and expected identity hostname.
- Sign in with an existing account whose password the operator knows. The user
  enters passwords and authenticator codes privately; never reset MFA for a test.
- Verify the enrolled administrator is challenged for MFA; wrong/missing codes
  fail, a valid fresh code succeeds, and logout/session revocation work.
- Check teacher/parent role boundaries using approved test accounts, without
  exposing learner records or changing real school assignments.
- Verify SSO only after production provider, exact callback, school binding and
  identity MFA are configured. A healthy Authentik container alone is not SSO.
- Verify document upload remains private and quarantined until clean scanning,
  then test approved retrieval. Do not introduce a real malicious sample.
- Record failures, response times, cold-start behavior and recovery evidence.

Configuration/unit tests and internal MFA probes do not replace these real
browser/password checks. Do not mark deployment complete until observed.
