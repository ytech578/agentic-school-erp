# Selected identity provider: Authentik

Selected by the project owner on 2026-10-19. The isolated Compose configuration
uses official server image `2026.8.4`, read from the vendor's Compose template on
that date. PostgreSQL and volumes are separate from ERP/Neon; the worker has no
Docker daemon socket. Only loopback ports are bound. Generated secrets are in
the ignored `.env.authentik` file, never in source or chat.

Local testing approved by the owner; no cloud server exists yet. The isolated
Authentik server, worker, database, HTTPS proxy and test cache were verified running
on 2026-10-19. The owner stopped this test stack on 2026-10-20 to free laptop RAM;
keep it stopped outside intentional test windows.
Signed OIDC, TOTP MFA recognized by ERP, missing-MFA denial, replay denial and
worker-driven provisioning/update/deactivate/reactivate passed protocol acceptance
on 2026-10-19. Real school accounts were not linked or changed. This is not a
browser visual test or a production deployment/recovery acceptance. Current PC
free memory recovered to about 2 GB after the user closed unused applications.
The vendor minimum is 2 CPU cores / 2 GB RAM for Authentik alone; allow ERP,
scanning and OS headroom and monitor memory during development.

## Isolated local development

Use the development overlay only on a developer machine:

```powershell
npm run identity:development:init
npm run identity:fixture
docker compose --env-file infrastructure/authentik/.env.authentik -f infrastructure/authentik/compose.yml -f infrastructure/authentik/development.compose.yml config --quiet
docker compose --progress quiet --env-file infrastructure/authentik/.env.authentik -f infrastructure/authentik/compose.yml -f infrastructure/authentik/development.compose.yml pull
docker compose --env-file infrastructure/authentik/.env.authentik -f infrastructure/authentik/compose.yml -f infrastructure/authentik/development.compose.yml up -d
```

Development secrets and a 30-day test CA/certificate live under ignored
`backups/identity`; the CA is not installed into Windows. Only the test Node
processes trust it. Do not disable TLS verification or trust this test CA on
production devices. Regenerate expired certificates only during an intentional
development maintenance window. Never copy development credentials to a school.

The test ERP uses its own newly named local database, a restricted RLS role,
fresh encryption/signing keys, port 4100 and a dedicated Redis on port 6381.
It does not seed or change the real Neon school. After building the API, start
it in a separate terminal from `apps/api`:

```powershell
$env:NODE_EXTRA_CA_CERTS = 'D:\Agentic School ERP V1.0\backups\identity\tls\ca.pem'
node --max-old-space-size=384 --env-file=../../backups/identity/erp-test.env dist/main.js
```

From the root, `npm run identity:verify:local` exercises actual API MFA enrollment,
recovery-code replay denial, SCIM Users create/replace/filter/deactivate/reactivate,
cross-school denial, privilege-escalation prevention, session revocation and
SCIM-token revocation. It checks the fixture school before mutations, never logs
secrets, and writes a local evidence report. Allow the normal login rate-limit
window to expire between repeated runs; the harness does not bypass throttling.
This test is **not** Authentik OIDC or worker-sync acceptance.

With the test API and Authentik running, prepare and verify the live test provider
from the repository root (keep the test CA environment variable set):

```powershell
node scripts/ops/identity-development-client.js
node scripts/ops/configure-identity-development.js
node scripts/ops/link-identity-development.js
node scripts/ops/configure-identity-mfa-development.js
node scripts/ops/sync-identity-development.js
npm run identity:verify:federation
```

The scripts use the installed API schema and store credentials/seeds only in
ignored `backups/identity`. The expiring synthetic SCIM token is valid for one
day: renew/reconfigure it after expiry, never extend it into production. OIDC
registration uses an exact callback, a confidential client, PKCE and an explicit
single-user application binding. No school demo seed, global MFA setting, real
account password or normal ERP identity-provider record is modified.

MFA is before the final login stage so Authentik's signed AMR reflects the verified
authenticator. A separate authorization-flow policy checks the current login
event and denies pre-existing password-only sessions; it is not an unconditional
`mfa` claim mapping. Missing authenticator responses cannot advance the flow.
The acceptance report is `backups/identity/federation-acceptance.json` and records
OIDC replay protection, verified MFA recognition and worker-driven session denial.
Protocols are tested over verified local TLS; browser visual behavior is untested.
An ERP SCIM parser fix now accepts `application/scim+json` for real IdP clients.

Stop only the identity test stack with the same Compose files and `stop` when
finished. Stop the separately launched port-4100 process too. Do not use `down -v`:
the identity database, configuration and evidence should remain recoverable.

## Production package after choosing the host

The same `production.compose.yml` package supports school-owned and approved cloud
hosts. Prefer a separate instance/database/key set per school. Branding or an
application binding is not a substitute for an independently isolated installation.
The future cloud deployment is explicitly deferred, not silently provisioned.

1. Copy `production.env.example` to an operator-owned ignored environment file.
   Generate distinct secrets using the initializer on a NEW installation, not by
   copying development keys. Set the approved hostname/interface and an absolute
   certificate directory containing trusted `fullchain.pem` and `privkey.pem`.
   Never combine production and development overlays.
2. Validate with Compose 2.24.4+:

```powershell
docker compose --env-file <operator-env-file> -f infrastructure/authentik/compose.yml -f infrastructure/authentik/production.compose.yml config --quiet
```

3. Review the rendered configuration privately before `up -d`; it contains secrets.
   Only the explicit HTTPS interface is published; PostgreSQL is not published,
   and base HTTP ports are removed. The proxy overwrites forwarded headers,
   supports WebSockets and omits access logs that could contain OAuth query codes.
4. Initialize the administrator through trusted HTTPS, enroll MFA and verify an
   independent recovery administrator. For school-owned DNS, distribute only the
   school's real trusted CA. Configure certificate renewal and test expiry alerts.
5. Configure school-specific application bindings, deny unassigned users, disable
   JIT initially and test the acceptance checklist below before enforcing SSO.
6. Keep identity backups separate from ERP backups: PostgreSQL logical archive,
   `/data`, custom `/templates`, `/certs`, exact image version and the original
   `AUTHENTIK_SECRET_KEY`. Encrypt archives; keep the recovery key separately.
   Coordinate a quiesced file/database snapshot. Test an isolated restore with
   outbound SCIM/SMTP blocked before reconnecting integrations. Never run two
   restored instances against the same live SCIM target during a drill.
7. Set up worker/database health, certificate expiry, failed sync/login events,
   disk space, memory/OOM and independent backup monitoring. Configure an approved
   administrator alert destination; no external email is sent by this package.

An encrypted offline backup and isolated restore/login drill passed locally on
2026-10-20, including schema/data, three volumes, original key, password/TOTP and
missing-MFA denial. Disposable recovery resources were removed and the original
test stack remains stopped. See `docs/identity-recovery.md` for commands and limits.
Independent off-host recovery and actual production acceptance remain pending.

Both Compose overlays and both nginx configurations passed validation locally.
That is not production load, failover, federation or recovery acceptance.

## Base startup (private HTTP only; not a complete production deployment)

From the repository root, generate secrets only if they do not already exist:

```powershell
npm run identity:init
docker compose --env-file infrastructure/authentik/.env.authentik -f infrastructure/authentik/compose.yml config --quiet
docker compose --env-file infrastructure/authentik/.env.authentik -f infrastructure/authentik/compose.yml up -d
```

On the host, use `http://localhost:9000` for the initial administrator setup.
Choose a distinct strong admin password and enroll MFA. Do not publish this
loopback development interface directly. Before ERP federation, configure a
stable trusted HTTPS identity domain/reverse proxy and back up Authentik's own
database, volumes and secret key. Do not disable TLS validation to make SSO work.

## OIDC first

Create one school-scoped confidential OAuth2/OIDC provider/application. Copy the
issuer displayed by Authentik exactly, use authorization code + PKCE, and register
only the exact ERP callback `${API_URL}/api/v1/sso/oidc/callback` (API_URL is the
origin, without `/api/v1`). Supply issuer, client ID and secret in ERP Settings →
Security → Identity providers. Use a teacher default role, no JIT initially, and
leave SSO enforcement OFF until tested. Bind only that school's users; do not
allow an unbound application to synchronize the whole directory.

Enable provider-side MFA. The ERP accepts MFA only from verified supported AMR
claims or its local authenticator challenge; federation alone is not proof.
Retain a separately controlled recovery process. Never disable password access
before proving both SSO and recovery work.

## Provisioning

Create an expiring ERP SCIM token for the same school and configure a static-token
SCIM backchannel at `${API_URL}/api/v1/scim/v2`. Token authentication does not
require Authentik's Enterprise OAuth-SCIM feature. Match institutional email and
external IDs. Start with a synthetic teacher: create, change, deactivate, verify
session denial, then reactivate. No real-user invitation/notification tests.

The ERP currently supports Users, not SCIM Groups. Configure user-only sync:
disable Authentik discovery (it requests `/Groups` BEFORE mappings run), and
use a group mapping that raises `SkipObject`. Both behaviors were verified on
this pinned release. User create-conflict resolution can still filter by email.
Map the user's active status explicitly. The installed release's mapping compiler
requires the stable `request.user` context for these precompiled mappings; do not
assume an injected `user` global exists during compilation. ERP roles must not be derived
from arbitrary untrusted group names or assigned SUPER_ADMIN.

## Required acceptance evidence

Signed OIDC login with nonce/state/PKCE; denied replay; MFA challenge; tenant/domain
restriction; disabled-user denial; provision/update/deactivate/reactivate; token
expiry/revocation; dual-control emergency access; identity backup and isolated
restore. SAML is a separate signed-assertion acceptance test if a school requires it.
Local OIDC/MFA/Users sync is verified above. Production recovery, real-school
onboarding, negative domain/JIT acceptance and live SAML are separate gates.

Vendor references:
- https://docs.goauthentik.io/install-config/install/docker-compose/
- https://docs.goauthentik.io/compose.yml
- https://docs.goauthentik.io/add-secure-apps/providers/scim/
- https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/user_login/
- https://docs.goauthentik.io/sys-mgmt/ops/backup-restore/
- https://goauthentik.io/pricing/
