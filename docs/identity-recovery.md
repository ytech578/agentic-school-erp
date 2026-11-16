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

New backups also create a private `.enc.json` transport manifest containing only
the encrypted archive name/size/checksum, source project, timestamp, immutable
image IDs and expected volume targets. It never contains the original identity
key, recovery encryption key, database dump, passwords or MFA material. Keep it
with the encrypted archive when making an independent copy. Verification checks
the sidecar when present against both encrypted bytes and authenticated bundle
metadata; older archives without a sidecar remain supported and report
`manifestVerified=false`. A sidecar cannot establish independent key custody,
remote-copy verification or restore/production acceptance. Those remain separate
checks, regardless of untrusted flags added to the sidecar.

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

## Staging administrator recovery-code handoff (9 November 2026 IST)

The private administrator password/TOTP login passed earlier. Following renewed
operator approval, a fresh forwarding-only SSH key and Cloud Shell preview were
opened for recovery setup, with the shared cutoff `2026-11-08T19:25:18Z`.
This does not publish Authentik: the public identity hostname still returned 503
and ports 9000/9443 remained unpublished. Historical access-window evidence is
retained separately; a cached page is not proof of an active tunnel.

`scripts/ops/private-identity-preview.js` supplies the HTTPS-aware loopback
adapter. It uses only built-in Node modules, a fixed loopback upstream, the exact
current Cloud Shell preview hostname and a deadline at most 30 minutes away.
It preserves session/CSRF cookies and WebSockets, rejects foreign origins and
caller-supplied proxy identity, logs no requests, and closes active sockets at
expiry. It is temporary setup tooling, not a production/public reverse proxy.
Use a separately approved SSH forward with the same hard cutoff; this adapter
does not register keys, open SSH, grant Google permissions or extend access.

The agent stopped at Credentials > Enroll > Static tokens, before selecting the
option that generates credentials. The operator must generate, save privately
in an approved password manager/offline location, and submit the enrollment.
Do not put recovery codes in chat, Git, screenshots, logs or VM backup folders.
Keep the existing TOTP device. Do not treat enrollment as recovery acceptance:
privately test one code at a fresh login, confirm it cannot be reused, and confirm
TOTP still works. If recovery codes are not offered, inspect the login validation
stage's allowed device classes; do not disable MFA or reset the administrator.

An independently held recovery administrator, school-specific SSO/SCIM binding,
scheduled off-host backups and second-host restore acceptance remain pending.
Privileged account creation and changes to identity access need separate approval.

At the follow-up, the operator confirmed recovery codes were saved. The device
list independently showed one Static tokens device alongside the existing TOTP
device, without opening either device's editor or reading any codes. Enrollment
and operator-reported custody are recorded; successful recovery sign-in,
single-use/replay rejection and continued TOTP operation remain separate tests.
The sign-out menu was prepared for a private fresh-login handoff. The original
window cutoff was not extended.

The operator subsequently reported "Recovery login passed" after the private
fresh-login handoff. The authenticated application library and administrator
interface link were independently observed at `2026-11-08T19:23:20Z`. This
accepts the operator-performed successful recovery-code login only. No password
or recovery code was read or entered by the agent. Rejection of that same used
code and continued normal TOTP login remain pending; the private window still
closes at the original cutoff and is not automatically extended.

After the cutoff, the operator reported the port was closed. At
`2026-11-08T19:27:30Z`, a read-only check confirmed no Cloud Shell listeners on
8080, 8082 or 18080. The ERP login still returned 200, private Authentik was
healthy, the public identity hostname remained 503, and identity host ports
remained unpublished. No access was extended. Connection closure is not a failed
recovery code or proof of replay rejection. The used-code rejection and subsequent
normal TOTP check need a separately approved new private window.

The temporary adapter also emitted a duplicate socket-close-listener warning
when Node reused upstream keep-alive connections. A regression test reproduced
the warning; socket tracking now registers cleanup once per socket rather than
once per request. This does not change authentication or the hard cutoff, and
the corrected helper must be used for the next approved window.

After separate operator approval, a fresh forwarding-only key and the corrected
adapter opened a new private verification window ending at
`2026-11-08T19:59:53Z` (9 November, 01:29:53 IST). The expired key/window was not
extended. The previous port-error page was reloaded, and the working MFA method
selection showed **Recovery keys** and **Traditional authenticator**. No code
entry or submission was performed by the agent. The public identity hostname
still returned 503 and identity host ports stayed unpublished. Current window
evidence is in the ignored `identity-recovery-verification-window-20261109.json`
beside the historical handoff report. Used-code rejection and subsequent normal
TOTP login remain pending operator tests, not accepted by merely reopening access.

At `2026-11-08T19:35:02Z`, the operator reported "Used code rejected;
authenticator login passed". The authenticated application library and
administrator-interface link were independently observed afterward. The current
administrator's privately performed recovery-code login, reported single-use
rejection and continued TOTP login are accepted. The negative challenge itself
was not observed by the agent, and no credentials/codes were captured. This does
not accept an independently held recovery administrator, tenant-wide enforcement,
school SSO/SCIM or production readiness. The latest verification-window report
and deployment acceptance report record this bounded scope; older handoff reports
retain their historical pending state. The approved window cutoff is unchanged.

Vendor reference: [Static authenticator setup stage](https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/authenticator_static/).

## Separate inactive school SSO pilot preparation

Following the administrator recovery checks, a read-only lookup confirmed school
`DEMO001` is active as Sunrise Public School, with 50 active teacher accounts and
no identity provider configured. The operator chose a dedicated non-admin pilot
and separately approved creation of only its inactive ordinary Authentik user.

At `2026-11-08T19:50:49Z`, the new pilot's saved overview showed Active: No and
Superuser: No; its Groups and Assigned Roles lists were empty. No password was
entered or read by the agent. No activation, ERP user, SSO provider, SCIM token,
mailbox or public identity access was created or changed by this step. The
Authentik organizational folder is not an ERP school/tenant binding. Inactive status was verified from configuration,
not by a password-based sign-in-denial test. The matched ERP account and all
school SSO acceptance remain pending. Private pilot details and exact-scope
approval evidence are in the ignored `backups/onboarding/demo001-sso-pilot-plan.json`.

The operator then confirmed the pilot password was saved privately. At
`2026-11-08T19:53:16Z`, its updated Last password change timestamp was visible,
and the saved Active and Superuser values remained No. The agent did not open,
enter or read the password. The pilot is still inactive; activation, pilot MFA
enrollment/login acceptance, matched ERP user and school/provider binding are
separate pending steps requiring the appropriate approval/private handoffs.

After separate, exact operator approval, only the ordinary Authentik pilot was
activated. Its saved overview showed Active: Yes and Superuser: No at
`2026-11-08T19:58:44Z`. No new group/admin assignment, ERP user, SSO connection or
public identity access was added. Activation persists until the user is disabled;
the temporary private-access cutoff is separate and unchanged. Pilot sign-in,
MFA enrollment and MFA sign-in are not yet accepted. The current window is nearly
expired, so obtain fresh time-limited access approval before a longer enrollment
handoff rather than extending the expired key/tunnel implicitly.

The operator separately approved a fresh 30-minute private window for pilot MFA.
The previous setup ports were all observed closed at `2026-11-08T20:00:13Z`.
A newly generated forwarding-only key and the tested HTTPS-aware adapter opened
the new window ending `2026-11-08T20:30:13Z` (9 November, 02:00:13 IST). The
working user portal was observed and the administrator's sign-out menu prepared;
the agent did not sign out, enter credentials or start a secret-displaying
enrollment flow. The operator must sign in as the pilot and privately enroll TOTP
and recovery codes, then perform a fresh MFA login. Those pilot checks remain
pending. Public identity still returned 503, identity host ports were unpublished,
and no ERP/group/admin access was added. Current window evidence is in ignored
`backups/onboarding/demo001-pilot-mfa-window-20261109.json`.

The operator reported "Pilot MFA login passed; recovery codes saved." The
authenticated pilot library and exact pilot username were independently observed;
the administrator-interface link was absent. On the later continuation, the
private preview had expired and its device list could not fetch. This error was
not treated as proof of zero devices or failed enrollment. Cloud Shell restarted,
its setup ports were verified closed at `2026-11-09T11:23:55Z`, and no key or
private window was renewed. A broader Google Cloud API authorization request
was declined because it was unnecessary for these checks.

At `2026-11-09T11:26:28Z`, a scoped PostgreSQL READ ONLY transaction through the
existing authenticated VM connection verified pilot ID 7, its expected username,
active status, one confirmed TOTP device and one confirmed static recovery-code
device. Only these non-secret fields and aggregate counts were selected; no
password hash, seed, QR or recovery-code values were read. This accepts the
operator-performed pilot MFA login, observed enrollment and reported private
code custody. Pilot recovery-code login/replay, wrong-MFA tests, matched ERP user,
school SSO/SCIM and production acceptance remain separate. The ERP public login
returned 200, Authentik was healthy, public identity remained 503 and identity
host ports stayed unpublished. Private evidence is in ignored
`backups/onboarding/demo001-pilot-device-verification-20261109.json`.

Create the matching ERP user only after exact approval through an authenticated,
school-scoped application workflow. Verify DEMO001 context first. A platform
super administrator needs the application's existing approved break-glass grant
to act in a school; do not bypass this with direct database writes, disabled
guards, changed ownership or a broader provisioning token. An existing authorized
school administrator can use the ordinary school-scoped workflow. The operator
must enter any new ERP password privately before submission.

At the subsequent handoff, the authenticated ERP session showed `SCHOOL_ADMIN`,
and School Config independently showed Sunrise Public School with registration
code `DEMO001`. A search found no existing match for the proposed pilot email.
The agent prepared only the named non-admin Teacher draft, explained that it
would be an active account with standard teacher permissions, and left private
password entry and submission to the operator. The operator reported "Pilot ERP
user created". At `2026-11-09T11:48:03Z`, the authenticated directory showed one
matching pilot with role `TEACHER`, status Active and last login Never. No new
password was read, generated or entered by the agent; no direct database insert
or tenant/break-glass bypass was used. Private bounded evidence is in ignored
`backups/onboarding/demo001-erp-pilot-verification-20261109.json`.

This accepts matching ERP account creation and its saved role/status only, not
pilot ERP sign-in, an external identity link or successful federation. The next
step is a separately approved, fresh time-limited private Authentik window to
prepare a pilot-only confidential OIDC client with the exact staging callback.
Client/provider creation, new credentials and public identity access require
their applicable action-time approvals and private credential handoffs. Keep
JIT provisioning and SSO enforcement disabled; do not grant all school users
access merely because one pilot account is ready.

After separate approval, a fresh key and private OIDC-preparation window were
opened with hard cutoff `2026-11-09T12:27:41Z` (9 November, 17:57:41 IST).
Cloud Shell needed reconnection during setup; the original cutoff was not
extended. At `2026-11-09T12:23:59Z`, both preview/tunnel listeners were loopback
only, private Authentik readiness returned 200, public identity remained 503 and
the ERP login returned 200. The working private library still belonged to the
ordinary pilot, not the Authentik administrator. No OIDC client, ERP provider,
SCIM token, firewall or public identity change was made. Only a few minutes
remained, so new credential setup was deferred. Private window evidence is in
ignored `backups/onboarding/demo001-oidc-private-window-20261109.json`. Any later
private access requires fresh approval rather than silently extending this key.

The operator subsequently reported the tunnel was closed while the browser was
on the sign-out invalidation route. At `2026-11-09T12:31:26Z`, read-only checks
confirmed no listeners on Cloud Shell ports 8080, 8082 or 18080, the SSH timeout
had terminated its process, and the preview had returned to its prompt. The ERP
login still returned 200 and public identity remained intentionally 503. The
browser could not connect to port 8082. This is the expected access-window
expiry, not evidence of a bad password or MFA failure. No administrator sign-in
or OIDC configuration was accepted, and no new key/window was opened. The latest
private window report records closure; reopening requires fresh approval.

After renewed operator approval, connection preparation and independent host-key
verification were completed before registering the new timed key. The first
registration attempt found the expired authorized-keys file no longer present
and failed before granting access; the checked user-owned path was then safely
created with mode 600. The new authorization begins at
`2026-11-09T12:41:07Z` and ends at `2026-11-09T13:11:07Z` (18:41:07 IST).
At `2026-11-09T12:41:55Z`, the loopback-only tunnel/preview worked, Authentik
readiness returned 200 and public identity remained 503. The interrupted pilot
sign-out completed and the normal login form was observed. The operator was
immediately handed the page for private existing-administrator password/MFA
entry. No new OIDC client, ERP provider, SCIM token, public identity or firewall
change was made. Current evidence is the ignored
`backups/onboarding/demo001-private-admin-window-20261109-124107.json`; the
previous expired-window record remains historical. Administrator sign-in in
this new window and all school federation acceptance remain pending.

The operator then reported "Authentik admin opened". The current authenticated
identity `akadmin`, administrator interface and administrator console were
independently observed within the same approved window. The saved Providers
and Applications lists both showed no objects. Only a new, unsubmitted
application draft was prepared, with a DEMO001-specific name/slug and policy
engine mode ALL, stopping before client credential configuration. No provider,
application access, ERP configuration or SCIM token was created. Exact-scope
creation approval was requested; client-secret entry/custody and its final save
must remain an operator-private handoff. Current draft metadata is in ignored
`backups/onboarding/demo001-private-oidc-draft-20261109.json`.

The planned application must bind access to pilot user ID 7 and its exact
username/email, and require all bindings to pass. The exact-email check prevents
a changed pilot email from silently selecting a different existing ERP account.
Do not create an unbound application: Authentik documents that no bindings means
all users have access. Keep the confidential provider limited to authorization
code, exact callback, minimal OIDC scopes and asymmetric signing. Do not use a
temporary Cloud Shell preview hostname as the persistent ERP issuer. References:
[application bindings](https://docs.goauthentik.io/add-secure-apps/applications/manage_apps/)
and [OAuth2/OIDC provider](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/).

The administrator overview also displayed a client/server clock-difference
warning. At `2026-11-09T12:45:34Z`, the VM reported NTP enabled and synchronized;
the laptop's UTC clock could be read, but reading Windows time-service status
was denied. No clock/MFA settings were changed and the warning's root cause or
resolution is not accepted. Review clock consistency before final federation
acceptance; do not disable time or MFA validation to suppress the warning.

After exact operator approval for the private pilot-only OIDC application, the
non-secret provider draft was prepared: confidential client, authorization-code
grant only, explicit-consent authorization flow, existing authentication and
invalidation flows, exact strict HTTPS callback, the existing asymmetric signing
key, only `openid`/`email`/`profile`, stable hashed-user-ID subject and per-provider
issuer. Every other displayed grant was unchecked. No private signing key was
opened and the application/provider was not submitted.

Authentik's new-client form displays an auto-generated draft secret in plain
text. A locator diagnostic included that unsubmitted generated value. It must
not be used: the operator was explicitly handed the form to privately replace
it with a fresh unique random secret, retain it in a password manager, and click
Next only once to Configure Bindings. No credential-page screenshot or secret
value was stored in the local evidence reports. The agent did not enter or save
a secret. The operator must complete credential entry and final submission;
do not submit the application until replacement is confirmed and the exact
pilot ID/username/email access checks are prepared. The interrupted diagnostic
does not justify retaining the generated value or bypassing credential privacy.

The operator subsequently reported a fresh secret saved privately. At the next
check, sanitized wizard headings showed Configure Bindings with no bound
policies. Before a screenshot was taken, the displayed page changed back to
Configure Provider; the screenshot included the unmasked operator-entered draft
secret. The agent immediately warned that this value must be replaced again
before use and removed only the newly generated local credential-bearing image,
verifying removal at `2026-11-09T13:11:12Z`. The tool output cannot be removed by
the agent, so local file removal alone does not resolve the exposure. The secret
is not repeated in these reports. No application was submitted by the agent.

The original private-window cutoff had elapsed by that removal check and was
not extended. Leave the unsubmitted draft open, with final submission blocked.
After separately approved fresh access, finish exact pilot access checks using
text-only, non-secret observations, then have the operator privately replace
the exposed secret immediately before their final submission. Do not take any
further screenshots of the OIDC wizard: concurrent navigation can re-expose
credential fields even after a non-secret stage was observed. The application's
creation/federation status must be reverified; none is accepted by this handoff.

The operator reported another private secret replacement and that Configure
Bindings was open, and separately approved a new 30-minute private window.
The new key/tunnel/preview cutoff is `2026-11-09T13:53:04Z` (19:23:04 IST),
starting at `13:23:04Z`; expired entries were not extended. At `13:24:39Z`,
both listeners were loopback only, private readiness returned 200 and public
identity remained 503. No OIDC-wizard screenshot or secret inspection was
performed in this window. The private replacement is operator-attested, not
verified by reading/comparing the secret.

Within the existing exact-scope OIDC approval, a single dedicated expression
policy `school-erp-demo001-pilot-identity-guard` was created separately. No
existing policy was modified or other application assigned. Its checks require
an authenticated, active, non-superuser with exact ID 7, username and email,
and reject a missing user. Authentik's live policy-test form returned Passing:
Yes for the pilot and Passing: No for akadmin. Eight standalone mock cases
also passed (exact pilot, wrong ID, wrong username, wrong email, inactive,
administrator, unauthenticated and missing user), without changing real users.
These test the expression, not a completed application/OIDC sign-in.

Exactly two bindings were prepared in the unsubmitted application draft: the
pilot user at order 0 and this policy at order 1, enabled, non-negated, with
30-second timeout and Don't Pass on failure. The saved draft name/slug and
ALL policy mode were independently rechecked. Final review and Create
Application were handed to the operator privately; no application/provider was
submitted by the agent. ERP providers, public identity, SCIM, JIT and SSO
enforcement remain unchanged. Current bounded evidence is the ignored
`backups/onboarding/demo001-binding-window-20261109-132304.json`. Do not accept
creation or school federation until the operator's save and the persisted
configuration are independently verified.

### DEMO001 private OIDC creation failure (2026-11-09)

The operator attempted final creation and received a provider validation error.
Sanitized server access logs show HTTP 400 from the transactional application
endpoint at 13:33:33Z. A read-only database transaction at 13:38:44Z confirmed
zero matching application slugs, provider names and client IDs, so no partial
application/provider was accepted. The previously tested guard policy remains
saved; this is not evidence of completed federation.

The reopened provider draft contained four empty redirect rows. Normal keyboard
entry committed the exact staging callback, but round-trip navigation duplicated
its rows. Pinned 2026.8.4 vendor source and rendered form structure show array
controls collected both through horizontal wrappers and directly, with array
merging in serialization. This explains duplication; the exact original server
validation body has not been retrieved. Later scope-mapping reads returned HTTP
500 at 13:46:27Z and required selection controls stopped rendering. Do not keep
submitting this unstable draft or loosen validation/access checks as a workaround.

The new-provider vendor form also generates a fresh client secret on rendering,
so the earlier operator-retained secret cannot be assumed to remain in the
remounted draft. Once the form/backend issue is resolved, the operator must
privately re-enter the retained unexposed value at the last credential step and
perform final submission personally. No wizard screenshots or secret inspection
are permitted. Current bounded private access still ends at 13:53:04Z
(19:23:04 IST); investigation does not authorize extending it. The ignored draft
report records this failure without credentials. ERP providers, public identity,
SCIM, JIT and SSO enforcement remain unchanged; no completed fix is claimed.

Subsequent sanitized diagnostics identified PostgreSQL OperationalError with
closed server connections and an OOM-killed identity database process under its
256 MiB limit. The VM had 4,917 MiB available; only this private database's
ceiling was raised online to 768 MiB (memory+swap ceiling 1,536 MiB; the host
currently has no swap). This did not restart containers, alter database contents,
resize the VM or change public access. Readiness returned HTTP 200; PostgreSQL
accepted connections and reported 15 connections of a 100-connection maximum.

The staging override now persists those limits, while the laptop/development
package remains unchanged. The same patch was applied with a rollback copy to
the exact deployed candidate configuration, and local/VM SHA-256 matched
`236adeb96c932d878d51e02eeee68ca7afeb275b80e7eba18015bd04bd2cf234`.
Seven targeted staging/preview regression tests passed (loopback tests require
network access outside the local sandbox). This accepts the resource correction,
not completed OIDC application creation or a long-duration load test. Investigate
the original HTTP 400 separately from the later OOM-related HTTP 500 errors.

The operator approved a fresh restricted verification window after health
checks. Its new forwarding-only key was registered at 13:56:51Z and expires at
14:26:51Z (19:56:51 IST), with no shell, no new public listener and forwarding
permitted only to the existing private identity endpoint. The prior 13:53:04Z
window closed automatically before this new key was registered. No old key was
extended. Client-secret entry and final submission remain private operator steps.

### Resumption checkpoint (2026-11-11)

The saved staging/preview regression tests were rerun: all seven passed, with
no skips. This verifies local configuration and preview safety only; it does
not establish current VM health or completed OIDC creation. SSH-in-browser
reported authentication failure after a normal Retry. Cloud Shell reconnected
but is waiting for the operator's Google authorization. No new SSH key was
registered and no private window was opened during this resumption check.

The 2026-11-09 verification window expired at its original cutoff. The operator
must reconnect the existing staging VM session and authorize Cloud Shell
privately. Then obtain fresh action-time confirmation for a new, restricted
30-minute window before registering another key. Recheck live resource limits,
database health, exact pilot/provider configuration and application absence
before any further creation attempt. The failed provider wizard remains
unaccepted; do not assume that its remounted credential or flow fields are
valid. Keep client-secret entry and final save with the operator.

At 07:19:18Z on 2026-11-11, the reconnected VM confirmed the 768 MiB
identity-database limit was still applied, PostgreSQL was accepting connections,
private readiness returned HTTP 200, and the public identity address remained
HTTP 503. A read-only query found zero pilot application/client matches and 16
of 100 database connections. The VM had 4,961 MiB available. The OOM flag is
historical; an online memory-limit increase does not clear it and is not evidence
of a new failure today.

After explicit fresh approval, a new forwarding-only key was registered at
07:23:29Z, expiring at 07:53:29Z (13:23:29 IST today). The missing authorized-key
file was created without clobbering under the existing account's owned,
non-symlink directory after checking SSH's existing key-file configuration;
no previous key was overwritten or extended. The only permitted destination
remains the private identity endpoint, and no interactive shell is allowed.
Both listeners were verified loopback-only, with private health HTTP 200 and
public identity HTTP 503 at 07:24:50Z. The exact cutoff applies to the key,
tunnel and preview, including active sockets. The administrator session had
expired; password/MFA sign-in was handed back to the operator. No OIDC
application/provider, ERP provider, SCIM, JIT or public access was changed.
Current bounded evidence is `backups/onboarding/demo001-resumption-20261111.json`.

The operator then confirmed akadmin sign-in, and the administrator interface was
observed. Session reload had cleared the old unsaved wizard, so a clean draft
was rebuilt within the existing exact pilot approval. The application name,
slug, confidential client ID and ALL mode were independently checked in Review.
All three required flows were explicitly selected and their displayed selections
rechecked: default authentication, provider explicit consent, and provider
invalidation. The existing asymmetric signing certificate name was selected
without opening its key material. Only authorization-code grants remained
selected; the password grant required its visible label to toggle successfully
and was independently verified disabled. Code/access lifetimes were 1/5 minutes.

Normal keyboard entry retained the single exact strict authorization callback.
The vendor wizard repeated the same callback twice on Review and repeated each
of the three selected scope mappings after a round trip; no different callback
or unrelated scope appeared. The final provider form was prepared with one
callback row. These vendor serialization duplicates must be inspected and
normalized in the persisted configuration before accepting completion. Exactly
two enabled, non-negated bindings were staged: pilot user at order 0 and the
existing identity-guard policy at order 1, both with 30-second timeout and Don't
Pass on failure. No application/provider was submitted by the agent.

After the last provider remount, secret entry and final submission were handed
to the operator: generate/retain a fresh random ASCII secret of at least 32
characters privately, replace Client Secret, advance through the checked
bindings/review without navigating back, and perform Create Application
personally. No secret value, secret length or credential screenshot was
inspected/captured. The unchanged cutoff is 07:53:29Z (13:23:29 IST today).
Creation, persisted deduplication and end-to-end federation remain unaccepted
until independently checked after the operator's save.

### Saved despite the completion error: verified recovery (2026-11-11)

The operator's final submission reported a generic response-code error. Do NOT
retry Create Application on that evidence alone. At 07:46:23Z, independent
read-only checks found one matching application and client, and subsequent
inspection found both exact pilot-only bindings persisted in ALL mode. A server
CancelledError was recorded at 07:44:20Z in the Django/ASGI response path. The
complete HTTP status/duration was not available in the inspected logs, so the
exact cancellation trigger is not conclusively established. An interrupted
response, including the old preview's 30-second upstream timeout, is consistent
with this state; it is not evidence that the database creation rolled back.

The stored provider contained two identical authorization-code entries and two
identical strict staging callbacks. At 07:59:00Z these two non-secret fields alone
were normalized in a guarded serializable transaction. The operation required
the exact client ID/provider ID 2, application name/slug, confidential type,
ALL mode and exactly the approved pilot/guard bindings, including enabled,
non-negated, 30-second timeout and Don't Pass on failure. It refused unexpected
grants, addresses or access rules. No secret column was selected or updated;
users, roles, access rules and public exposure were untouched. Before/after
evidence and the bounded SQL recovery artifact are retained under ignored
`backups/onboarding/`; they are not reusable application hardcoding and are
excluded from deployment source packages.

An independent read-only transaction at 08:03:57Z confirmed exactly one
application/client, ALL mode, two bindings, one code grant, one exact strict
authorization callback, the three intended authentication/consent/invalidation
flows, and only email/openid/profile mappings. A SHA-256 comparison of canonical
guard code matched the exact approved expression. Private readiness was HTTP
200 and public identity remained HTTP 503. Both temporary listeners were absent
at 08:03:56Z; no expired key/window was extended or restarted.

The local private-preview helper now waits up to a bounded 120 seconds for slow
administrative responses, while retaining the original approved-window hard
cutoff, request/body limits, host/origin checks and loopback-only listeners.
Interrupted/timed-out requests return non-cacheable 502/504 reconciliation
warnings: a change may have completed and must not be blindly retried. It never
automatically retries writes. Tests reproduce a synthetic committed write with a
lost response, verify a longer bounded wait, and prove the hard cutoff still
ends active requests. All 86 operations tests passed, with no failures/skips.
This new helper is prepared locally for the next separately approved window;
it was not activated by reopening the expired window. Live browser acceptance
of that helper remains pending.

Accept private IdP application creation and normalized configuration only.
Do not accept secret correspondence, token exchange, ERP provider binding,
stable-origin publication, end-to-end federation or production readiness from
these configuration checks. Retain the operator's privately stored secret; its
value, length and hash were not inspected and it was not rotated. The current
evidence file is `backups/onboarding/demo001-resumption-20261111.json`.

### Disabled ERP pilot connection saved and verified (2026-11-11)

The operator entered the matching client secret and performed the final ERP
provider save privately. The ERP displayed its OIDC creation success and the
provider row showed Disabled / Password allowed. An independent read-only
database transaction at 08:51:33Z confirmed exactly one matching provider in
active school DEMO001: slug/client ID `school-erp-demo001-staging`, the stable
Authentik issuer under `auth-staging.agenticschoolos.in`, allowed domain
`agenticschoolos.in`, default role TEACHER, and enabled/JIT/enforced-SSO all false.
The already provisioned pilot remains an ACTIVE TEACHER. No credential column
was selected, and no role, live provider flag or public-exposure setting was
changed by these checks. Secret correspondence is not yet accepted.

Private identity readiness returned 200; the public identity hostname remained
intentionally 503. Public DEMO001 provider discovery returned 200 with an empty
list, consistent with the disabled connection. Approximately 4957 MiB of VM
memory was available at this check; this is not sustained-load acceptance.

The next consequential step needs explicit approval for stable-origin
publication and enabling only this ERP pilot connection. The current ingress
publication switch exposes the full Authentik hostname, including login and
authenticated administration/API routes; it is not an OIDC-only allowlist or
private-admin control. Explain this scope before switching it on. Keep JIT and
enforced SSO off, preserve ordinary ERP password/MFA login and rollback, then
verify TLS/discovery, pilot restrictions and operator-performed end-to-end login.
No publication, token exchange, school-federation or production acceptance is
implied by this disabled-connection verification.

### Approved public staging identity and pilot enablement (2026-11-11)

The operator explicitly approved publication of `auth-staging.agenticschoolos.in`
and enabling only the saved DEMO001 ERP pilot provider, after disclosure that the
proxy publishes the full identity hostname, including login and authenticated
administration/API routes. At 09:00:58Z the private runtime file gained only
`AUTHENTIK_PUBLIC_ENABLED=1`; its exact prior bytes remain in a 0600 rollback
copy. Only the shared HTTPS proxy was replaced at this stage. Public discovery
and ERP login returned 200. An API-container check at 09:01:52Z validated TLS,
the exact issuer/endpoints, S256 support and retrieval of one public signing key,
without private key parameters. No certificate verification was bypassed.

The initial provider-enable attempt failed. Read-only reconciliation at
09:04:54Z proved it remained disabled and identified three stored null SAML
fields rejected by the OIDC request schema. Separately, the deployed login
bundle's `/api/sso/.../start` returned 404 at the shared ingress. Fixes normalize
only persisted nulls before merging the validated patch, still rejecting explicit
null inputs and incomplete active protocols, and internally rewrite the legacy
SSO prefix into the canonical API location. Queries, authentication handlers,
cache/security headers and query-string log suppression remain intact.

Nine targeted API tests, the API type-check/build, changed API-file lint and all
86 operations tests passed. Restricted-sandbox filesystem/socket denials were
resolved by rerunning the local tests with appropriate execution permissions;
no assertions or access controls were removed. The isolated synthetic HTTPS
test verified the legacy route/query and security headers, then cleaned up its
own temporary containers. The exact compiled provider module also passed a
no-network, read-only-container regression against the deployed dependencies.

At 09:16:07Z a narrow patch was deployed: one tested compiled provider module
layered on the exact existing API image, plus the tested proxy template. No
unrelated local source or configuration secrets were uploaded, no database
migration ran, and the web/identity/database/scanner services were not restarted.
The API returned healthy and the proxy reloaded successfully. The old image,
image-override file and proxy template remain available for rollback. Runtime
configuration and the private publication rollback copy remain 0600.

At 09:16:39Z the exact existing provider was enabled through the deployed domain
service in a school-scoped transaction, guarded by row locking and exact pilot
configuration checks. JIT/enforced SSO remained off; the default role remained
TEACHER. An independent read-only check at 09:19:25Z confirmed the saved flags,
before=false/after=true audit snapshot and existing active school administrator
actor. Audit integrity-chain presence was checked, not a full chain replay.
No users, roles, groups, signing keys or MFA configuration were changed.

Public canonical and legacy SSO starts returned 302 to the correct identity
authorization endpoint with the exact callback, code flow, PKCE S256, state and
nonce. Secret material was absent from the redirect, and transient parameter
values were not logged. Unknown school/provider returned 404, invalid callback
state 401, anonymous ERP provider administration 401, and anonymous Authentik
user administration 403. The ERP UI showed Enabled / Password allowed. All
application/identity/scanner containers remained healthy with approximately
4985 MiB VM memory available; sustained-load acceptance remains separate.

The real browser login page discovered the one provider, followed its SSO button
successfully and reached the public Authentik challenge naming the expected
pilot application. Only `demo001-sso-pilot` was prefilled. Password/MFA entry and
expected application consent were handed to the operator. Do not accept client
secret correspondence, token exchange, the resulting pilot's tenant/role/session,
broader school federation or production readiness until the remaining operator
login and independent post-login checks pass. This publication is persistent,
not a new temporary Cloud Shell window. See the latest staging evidence in
`backups/onboarding/demo001-resumption-20261111.json` for rollback references.

### Public DEMO001 teacher OIDC/MFA pilot accepted (2026-11-11)

The first dashboard report was not accepted while the pilot tab still showed
the expected Authentik consent screen. The operator completed Continue and then
reported the ERP dashboard at the staging origin. Independent browser inspection
confirmed `/dashboard`, display name DEMO001 SSO Pilot, role TEACHER and the
teacher workspace, not an administrator dashboard. The same authenticated
teacher dashboard remained after a browser reload.

A separate read-only database transaction at 09:31:47Z confirmed active school
DEMO001, exactly one matching existing ACTIVE TEACHER account created before
provider enablement, and exactly one external identity linking that account to
the approved OIDC provider. The link was created at 09:29:35Z. One active,
unexpired OIDC ERP session was created at 09:29:36Z with `mfaVerifiedAt` populated.
The transactional FEDERATION CREATE audit matched the provider and existing
user and recorded `jitProvisioned=false`. Provider JIT/enforced-SSO flags remained
false. No credentials, token hashes, external subjects or claims were selected
for the verification report; password/MFA/consent entry stayed with the operator.

Accept this one public staging teacher's completed OIDC code exchange, correct
existing-account/school/role link, MFA-verified ERP session and immediate browser
reload persistence. The successful exchange establishes working client-secret
correspondence without inspecting its value, length or hash. It does not prove
all-school federation, adversarial replay/authorization testing, expiry/logout
or revocation, SCIM lifecycle, independently held recovery administration,
identity backup/restore/login acceptance, monitoring/capacity or production
readiness. Those gates remain separate and unaccepted. Keep JIT and enforced
SSO off, with normal password/MFA fallback available. The pilot evidence is
recorded in the latest onboarding report and linked from deployment acceptance.

### Next recovery preflight, no live maintenance performed (2026-11-11)

After the completed public teacher pilot, read-only staging inspection confirmed
exactly the expected identity server/worker/database services and three named
persistent mounts, no published identity container ports, an approximately 43 MB
identity database and small file volumes. The VM had approximately 4967 MiB
available memory and 39 GB free disk at this check. No identity services were
stopped, live database restored, pilot revoked or SCIM credential issued.

Only the old local synthetic encrypted backup and local development recovery key
were found on the laptop. They are not evidence of staging recovery protection
and must not be reused as an accepted staging backup. No staging identity backup
key/archive was found under the inspected private VM recovery paths. The source
VM also lacks a host Node runtime for the existing Docker-orchestrating backup
script; prepare a checksum-verified maintenance runtime before the offline window,
without granting Docker control to the running ERP application.

The new transport-manifest tests and all 88 operations tests passed. Seven
SCIM/session-administration unit tests passed separately; these are not live
school provisioning or revocation acceptance. The new backup helper has not yet
been deployed or used against staging.

Actual staging backup still requires an approved Authentik-only maintenance
window, a dedicated staging recovery key held separately by the operator, and
an approved private destination for the encrypted archive plus manifest. Keep
the key out of R2. An isolated restore must use newly named resources, publish
no ports, reconnect no worker or integrations and never overwrite the source.
The existing automated restored-login path accepts only the local synthetic
fixture: do not relabel it as an operator staging login check. Restored staging
credential/login acceptance and second-host recovery remain separate pending
checks. Vendor recovery inventory reference: [Authentik backup and restore](https://docs.goauthentik.io/sys-mgmt/ops/backup-restore/).

### Staging encrypted backup, independent copy and isolated data restore (2026-11-11)

After explicit approval, a dedicated staging recovery key was created privately
on the VM with mode 0600, without reusing the development recovery key. Its value
was never displayed. A checksum-verified official Node maintenance binary and
the reviewed recovery scripts were installed in a private maintenance directory;
the running ERP application was not granted Docker control. Native recovery
tests passed before maintenance.

Identity-only maintenance started at 10:05:03Z. Server and worker were stopped;
the source database and ERP services were not stopped or restored over. The
encrypted bundle was created at 10:05:08Z and includes the database, all three
persistent volumes, original identity runtime key and immutable image IDs.
The SSH session disconnected during restart verification. The independent
ten-minute resume watchdog succeeded; on reconnection, the source identity
server, worker and database were healthy and private readiness returned 200.
The exact outage duration was not measured and must not be reported as accepted.

Archive `identity-1794391517540-da81a506.enc` (6,420,090 bytes) and its 613-byte
non-secret manifest passed authenticated decryption, entry and manifest checks.
At 12:28:02Z, only that encrypted archive and manifest were copied to the existing
private R2 bucket under `identity-backups/school-erp-staging/`. Both objects were
downloaded and their complete hashes checked. Conditional creation prevented
overwrites. No recovery key or unencrypted runtime credential was uploaded,
and bucket/public-access settings were not changed. The operator still needs
to save the dedicated recovery key outside the VM, separately from R2; no
independent-key-custody acceptance has been claimed.

At 12:28:52Z a disposable, network-isolated restore completed in 17 seconds.
Restored database schema/data and all three volume inventories matched; the
original runtime key was recovered inside the authenticated encrypted bundle.
No ports were published, restored worker or integrations started, or source
database overwritten. The tool removed its owned disposable resources.
This accepts data-level recovery only: no real operator password/MFA login was
performed against a restored staging identity runtime. The local synthetic login
option remains explicitly unsuitable for that acceptance.

Maintenance also exposed stale proxy upstream resolution: direct identity
discovery returned 200 while the public route returned 404. Reloading the
validated proxy restored public discovery to 200. The staging proxy now uses
Docker DNS with five-second address validity and shared upstream zones for the
web, API and identity services. A synthetic test on the VM moved its backend to
a guaranteed different address and verified recovery without proxy reload,
alongside TLS, security headers, default unpublished-identity denial, API paths
and upload protections. Its newly named containers/network were cleaned up.
The laptop Docker engine was unavailable; no real stacks were started to run it.
Linux root-run fixture file ownership was corrected while retaining 0600 files
and non-root test containers. All 89 operations tests passed with no skips.

The first live DNS-fix attempt rolled back automatically because its Python
public health client was denied. That same client returned 403 with the original
configuration, while the independent curl probe returned 200. No security rules
were disabled or bypassed. The guarded retry required curl's normal system TLS
validation, the exact expected discovery issuer, code response support, S256
support and ERP login HTTP 200. Both live endpoints passed at 12:43:54Z; rollback
copies of the original template and active configuration remain private on the
VM. Application services were not restarted for the proxy update. Nginx's
dynamic upstream prerequisites are documented in the official
[upstream module reference](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#resolve).

Non-secret checksums, receipt locations and acceptance boundaries are recorded
in `backups/onboarding/staging-identity-recovery-acceptance-20261111.json`.
Independent key custody, restored operator password/MFA login, scheduled identity
backups with failure alerts and second-host/cross-region recovery remain pending.
Pilot access and sessions were not revoked; no SCIM credential was issued.
Production acceptance remains false.

### Operator confirmation of external staging recovery-key custody (2026-11-11)

The operator subsequently confirmed "key saved outside VM". Record this as an
operator attestation, not independent inspection of the destination or proof
that the external copy can decrypt the backup. The storage type was not supplied;
no key contents were requested, opened or copied into the evidence. Restored
staging operator password/MFA login, scheduled backups and failure alerts, and
second-host/cross-region recovery remain pending. A fresh private access window
for a restored-runtime login requires separate approval; do not reuse expired
tunnel keys or publish a restored identity service.

### Temporary isolated restored operator-login copy prepared (2026-11-11)

After the operator approved creation of a temporary isolated Authentik copy,
the shared archive loader and existing restore implementation were reused rather
than duplicating the recovery logic or permitting synthetic credentials against
staging. The new `scripts/dr/identity-operator-window.js` requires the explicit
approved source checksum/project and a new private directory. A cleanup plan is
written and an independent watchdog scheduled before any containers are created.
All 95 operations tests passed, including new deadline, ownership, archive-loader
and opaque loopback-relay checks. The same recovery tests exited successfully on
the VM before startup. Neither the backup key nor runtime secrets were uploaded
from the laptop; the tools read the approved encrypted archive and existing key
privately on the VM.

At 13:06:38Z, the database/schema/data and all three restored volumes matched,
the restored server was ready, and its host-loopback relay returned HTTP 200.
The database uses a network-disabled namespace; the restored server shares only
that namespace. No container port is published and no restored worker is started.
The fixed relay binds only 127.0.0.1:28082 and carries opaque streams through an
invocation-owned Docker exec bridge without logging requests, cookies or bodies.
It accepts at most 24 connections and closes active access at its hard deadline
13:36:38Z (19:06:38 IST). The runtime has a 40-minute service limit and a separate
45-minute cleanup watchdog. Cleanup checks exact random invocation names and
ownership labels, never source names. Expiry/cleanup for this particular window
must still be observed before claiming that it completed.

The VM retained approximately 4488 MiB available memory after startup. All live
identity/database and ERP API/web services stayed healthy; live OIDC discovery
returned 200. No source service was stopped, source database overwritten, account
or credential reset, public identity setting changed or SCIM token issued.

Fresh forwarding-key registration and private browser access remain unperformed
pending action-time consent; the existing Cloud Shell also displays its normal
Google authorization prompt. Existing preview cookies must not be mistaken for
a fresh restored password/MFA test: begin at the restored origin's logout/login
flow, and have the operator enter existing credentials privately. No operator
login or production acceptance has been recorded. Window metadata and bounded
acceptance are in `backups/onboarding/staging-identity-operator-window-20261111.json`.

### Restricted restored-copy browser window opened (2026-11-11)

The operator separately approved the new restricted connection with the original
19:06:38 IST cutoff. Existing Cloud Shell authorization was refreshed without
changing IAM. A fresh Ed25519 private key was generated and retained only in a
private Cloud Shell temporary directory; its value was not inspected or sent to
the VM. The VM host public key was obtained through the authenticated existing
VM session and matched the previously verified host fingerprint. Dedicated
known-host pinning and strict checking remained enabled.

The expected SSH key file was absent; read-only effective SSH policy confirmed
that the normal per-user authorized-key file is supported. That file was created
with mode 0600 in the existing 0700 SSH directory. At 13:19:34Z, only the approved
key was added, preserving any existing bytes. Its options use `restrict`, the
unchanged UTC expiry and a forced Python stdio relay to 127.0.0.1:28082. SSH TCP/
stream forwarding, PTY, agent, X11 and user-rc execution remain disabled; no shell,
arbitrary destination, project metadata or firewall access was granted. This is
more restrictive than enabling SSH port forwarding with a destination filter.
The forced relay returned HTTP 200 when a requested shell command was supplied,
and an SSH protocol forwarding attempt was administratively denied.

The first health probe closed stdin before reading and returned no response.
A persistent full-duplex probe passed. The local reusable relay was subsequently
hardened to preserve a delayed response after a request half-close and to wait
for child stdio closure rather than truncating at process exit. Its new regression
and all 97 operations tests passed. Active window processes were not restarted
to apply this later source hardening during the operator login handoff; do not
claim it as a hot-deployed change to this window.

At 13:26:37Z the Cloud Shell loopback adapter returned 200. The private HTTPS
preview then completed the restored origin's invalidation flow and reached a
fresh default-authentication form. Only the known username `akadmin` was
prefilled. Existing preview cookies were not accepted as a password/MFA test.
Password and normal authenticator-code entry were handed to the operator; no
credential values, codes or screenshots were requested. The page is the isolated
restored copy, not live Authentik. Its original 13:36:38Z deadline was not extended.
Restored password/MFA acceptance and actual expiry/cleanup verification remain
pending until separately observed. Refer to the updated operator-window evidence.

### Restored administrator password and normal MFA login accepted (2026-11-11)

The operator reported "Restored Authentik login passed after MFA". Before the
unchanged cutoff, independent inspection of the isolated preview origin showed
the authenticated application library and administrator-interface link. The
ordinary user menu identified `akadmin`; credential settings were not opened.
After a browser reload, the same restored-origin library and administrator link
remained available. No password, authenticator secret/code, recovery code,
session cookie or token was read or entered by the agent.

Accept the existing administrator's restored password and normal-authenticator
login based on the operator-performed challenge and independently observed fresh
restored session. This does not claim that the agent observed code entry, tested
missing-MFA denial or recovery-code replay in the restored copy, replayed ERP
OIDC against it, or recovered onto a second host. Private-window expiry and
invocation-owned cleanup remain pending and must be observed separately. No
live-account access, live session, SSO provider or public configuration changed.

### Restored window expiry and access cleanup verified (2026-11-11)

After the original cutoff, the existing VM/Cloud Shell consoles disconnected and
were reconnected normally; no expired test key was used to regain console access.
At 13:42:04Z the automatic close report existed, the runtime had exited with
status 0, both owned containers and all three owned named volumes were absent,
and VM port 28082 was closed. The report still records that no *automated*
restored password/MFA challenge was performed; it must not be edited to infer
the separate, operator-performed/browser-verified login accepted above.

At 13:43:34Z both Cloud Shell preview ports were closed without manual process
termination. A fresh attempt with the expired test key was denied authentication.
Only the invocation-owned temporary SSH private/public key files were then
removed, without reading the private key. The non-secret tools and cleanup
receipts were retained. The separately held recovery encryption key was not
part of these temporary Cloud Shell files and was not removed.

At 13:45:33Z the exact registered temporary access entry was already absent
from the VM key file; no other entries were removed or rewritten. Do not attribute
that disappearance to a particular mechanism without evidence. The encrypted
backup still matched its recorded checksum and the separate VM recovery key
remained present with mode 0600. The expired restored browser tab was closed.
Live identity/database/server/worker and ERP API/web services remained healthy;
live ERP login and OIDC discovery both returned 200 with normal TLS validation.

Accept this bounded staging backup/restore/operator-login exercise and its
temporary-resource/access cleanup. Scheduled encrypted identity backups, failure
alerts, second-host/cross-region recovery and overall production acceptance are
still separate pending work. The operator's external key-copy custody remains
an attestation, not an independently performed external-key recovery test.

### Scheduled identity backup implementation and disabled staging installation (2026-11-11)

The operator approved daily **03:00 Asia/Kolkata** identity maintenance and no
automatic archive deletion. The encrypted identity backup service and separate
hourly missing/stale/failure monitor are now implemented; configuration, systemd
units, activation gates and second-host instructions are in
`infrastructure/backups/identity/README.md`. This is separate from Neon ERP
database backups and does not provide or claim cloud WAL/PITR.

The staging VM installation is root-owned under `/opt/school-erp-backup`, with
private configuration under `/etc/school-erp-backup` and backup state under
`/var/lib/school-erp-identity-backup`. Both timers remain **disabled/inactive**.
No live Authentik sign-in pause or live scheduled backup was performed in this
step. The approved alert recipient was saved privately; SMTP sender configuration,
actual inbox delivery, a separately approved immediate maintenance test, and the
first scheduled-run acceptance are not complete.

Four systemd unit files passed Linux syntax validation; the timer expression
resolved to 21:30 UTC / 03:00 India time. A fresh independent constrained transport
container downloaded and fully verified both existing private R2 objects, with
identical existing copies and no overwrites. It did not use the running ERP API,
read a recovery key, send email, or change bucket/public access.

An isolated synthetic failure exercise armed the real independent resume timer,
paused only healthy dummy identity services, failed before any database dump,
resumed both, disarmed the timer and recorded failure without a false successful
backup/alert. All owned test resources were removed. A second exercise produced
and authenticated a complete encrypted backup of an empty synthetic PostgreSQL
database and three test volumes under the service's actual read-only filesystem
restrictions. Intentionally absent test storage/sender credentials caused the
expected remote-transport failure without real R2 writes or email. Both synthetic
services resumed and all owned containers/volumes were removed. Neither exercise
used live school data, identity secrets or the real recovery key.

Validation also found and corrected an entry-point attempt to create the default
backup directory inside the immutable installation. Output now goes only to the
configured private state directory during a backup; verification does not create
an installation-side backup directory. A dedicated regression protects this.

The complete local operations suite passed **120 tests**, and the final targeted
Linux suite passed **37 tests**, without failures or skips. The final hardened
synthetic run also passed after binding watchdogs to their original invocation,
so a delayed old watchdog cannot resume a newer backup. Root-owned installed
source hashes were compared against the reviewed package. Staging verification
artifacts are retained under
`/home/ytech578/school-erp-secrets/identity-backup-package-20261111-175a3e1d`.
The non-secret source-machine/Docker-daemon proof is prepared for a later recovery
host. The second-host guard rejects both the same machine and a Docker daemon
pointing back to the source; its isolated data-only restore requires an independent
cleanup watchdog and does not publish ports or start a restored worker.

The operator reports **no second host yet**, so no second-host recovery was run
and no paid VM was created. A separately hosted dead-man monitor is also pending:
an alert service running on the source VM cannot report that VM's own failure.
These implementation/synthetic results are not delivered-alert, scheduled-run,
second-host/cross-region, external-key recovery, or overall production acceptance.

On the 2026-11-12 continuation, final ownership inspection found that copied
scripts, binaries and units had retained the source account's ownership. The
installer now explicitly applies root ownership after every copy. After verifying
the exact source hashes/vendor binary, only this installation's known code,
units, configuration and directories were corrected; private environment contents
were not changed. Fourteen installed files and their parent directories were
verified root-owned/non-writable by ordinary accounts. The new ownership
regression and all final tests passed. `source-files-release.json`,
`ownership-remediation-20261112.json` and the final readiness receipt retain this
evidence without changing any historical receipt or claiming timer activation.

### Resend alert sender configured; SMTP test accepted (2026-11-12)

The operator confirmed the ERP domain was verified in Resend and privately saved
the sending key in the root-owned 0600 alert configuration. Strict preflight
rejected duplicate SMTP settings before any email was sent. A guarded, reviewed
cleanup retained the exact existing key, removed old defaults, selected only the
explicitly approved recipient, and saved a private 0600 rollback copy. No key
value was displayed, hashed or logged; a conflicting credential would have
required operator resolution rather than selecting a key automatically.

Final preflight passed for the Resend TLS endpoint on port 465, expected sender,
approved recipient and disabled/inactive timers. Exactly one `TEST_ALERT_ONLY`
email was attempted through the installed sender and accepted by SMTP. This is
not proof of inbox delivery; operator Inbox/Spam confirmation remains pending.
At 2026-11-12T14:15:23Z all five checked ERP/identity services were healthy and
both timers remained disabled/inactive. No backup ran and identity sign-in was
not paused. See the private `staging-resend-alert-acceptance-20261112.json` record
and its VM receipt. Do not enable scheduling or claim live backup acceptance from
SMTP acceptance alone.

The operator subsequently confirmed receipt in Gmail's **Updates** inbox tab.
Accept delivery of this one test alert based on that operator report; no mailbox,
password or API-key contents were inspected. The private acceptance record now
marks inbox delivery accepted. This does not authorize an immediate identity
maintenance interruption, enable timers, or establish VM-down alert delivery.
The separately approved live backup test and scheduled-run acceptance remain
pending.

### Approved live identity backup test (2026-11-12)

Following explicit approval for immediate maintenance, the installed backup service
ran once from 14:36:33.927Z to 14:37:33.343Z (20:06:33 to 20:07:33 IST). Eleven
installed script/unit hashes and protected root ownership passed preflight. The
service completed successfully with exit status zero. The new 7,124,278-byte
encrypted archive and manifest were authenticated locally; the private R2 upload
receipt verified full GET checksums for both objects. Only ciphertext and its
non-secret manifest were uploaded, not the recovery key.

At 14:44:10.318Z both identity services had resumed healthy and all five checked
ERP/identity services were healthy. ERP API, ERP web and identity database container
IDs, start times and restart counts were unchanged. Public ERP login returned HTTP
200, and the expected public OIDC issuer/PKCE discovery check passed. No pending
resume plan or active resume watchdog remained. Both backup timers stayed disabled
and inactive; no automatic deletion was configured.

The private `staging-identity-live-backup-20261112.json` record and VM
`live-maintenance-test-20261112.json` retain the evidence. Fresh operator SSO/MFA
login after resume remains required before scheduling acceptance. This manual run
does not prove the first timed run, second-host recovery, Neon backup/PITR,
independent VM-down alerts, or overall production readiness.

### Schedule activated after operator login acceptance (2026-11-12)

The operator reported a fresh pilot SSO/MFA login passed after the manual backup.
This is operator-provided login evidence, not an inspection of passwords or codes.
An isolated synthetic failed-run status then exercised the real monitor/Resend
failure-alert path: SMTP accepted the one simulated notification, the live backup
status remained byte-identical, and only this test's temporary ciphertext copies
and status were removed. No live backup was failed, no credentials were changed,
and identity was not paused. Inbox delivery of this additional synthetic message
has not been separately confirmed; delivery of the earlier test was confirmed.

Following revalidation of the eleven installed code/unit hashes, five healthy
services, fresh successful backup status and normal health-monitor success, both
timers were enabled and observed active at 2026-11-12T14:54:30.583Z. The backup
timer's first future trigger was **13 November 2026, 03:00 IST**; the hourly monitor's
next trigger was **12 November 2026, 20:30:27 IST**. Activation did not start another
live backup. The no-catch-up backup policy and no-automatic-deletion policy remain
unchanged. Private activation and synthetic-alert receipts are retained alongside
the manual test receipt, with a local non-secret activation record under
`backups/onboarding/staging-identity-schedule-activation-20261112.json`.

Do not mark first-scheduled-run acceptance until that future run and its remote
receipt are observed. A second recovery host is still unavailable. These enabled
Authentik timers are not always-on Neon ERP backups, independent VM-down monitoring,
second-host/cross-region restore acceptance, or overall production readiness.

### First scheduled run accepted retrospectively (verified 2026-11-14)

Read-only inspection of the historical systemd journal identified the first run
due **13 November 2026, 03:00 IST**: it began at 21:30:00.012438 UTC on 12 November
and completed at 21:30:56.682 UTC, with a successful application result and systemd
job completion. The configured schedule, activation baseline, timer/service
relationship and exact journal timestamps establish the scheduled-run correlation.
Neither the earlier manual test nor the later 14 November run was substituted.

The distinct 7,301,810-byte encrypted archive and its manifest authenticated,
including all four recovery entries. On 14 November, a separate constrained,
GET-only verification fully downloaded both exact private R2 objects and matched
their byte counts and SHA-256 checksums. No recovery key entered the transport,
and no upload, deletion, new backup or restore was performed for this check.

All five checked services were healthy. ERP API/web and the identity database
retained the container IDs, start times and restart counts recorded before the
manual test. Authentik server/worker had resumed; public ERP login returned 200
and the expected OIDC issuer/PKCE discovery passed with normal TLS validation.
No pending resume plan or watchdog remained. Both identity backup/monitor timers
were enabled and active, the monitor's latest result was successful, and the
no-catch-up/no-automatic-deletion policies remained unchanged. Four installed
worker/recovery/unit hashes matched the reviewed local source.

The database's Docker OOM flag was investigated rather than ignored: matching
kernel records dated the event to 9 November, before schedule activation, with
no later matching event observed. It was not a new backup failure; the database
was healthy and had not restarted during these backup runs.

Non-secret evidence is in the ignored local record
`backups/onboarding/staging-identity-first-scheduled-run-20261113.json`, with a
private VM copy at
`/var/lib/school-erp-identity-backup/first-scheduled-run-acceptance-20261113.json`.
This accepts the first scheduled Authentik backup only. A genuinely separate
recovery host is still unavailable; second-host recovery, independent external-key
recovery, Neon ERP backup/PITR and overall production readiness remain unaccepted.
