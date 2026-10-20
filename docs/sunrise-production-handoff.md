# Sunrise Public School: cloud deployment handoff

Confirmed by the owner on 2026-10-20: **Sunrise Public School**, school code
**DEMO001**, cloud installation. A Vercel account exists; its plan is unknown.
There is currently no production server, domain or institutional email domain.
The private draft is `backups/onboarding/sunrise-public-school.json`. No production
school/account was created, and existing campuses were not changed.

## Recommended hosting

Vercel can host the Next.js interface. Keep the current continuously running API,
background work, Redis, ClamAV, Authentik server/worker and identity PostgreSQL on
an approved always-on Linux server with persistent storage. The existing Compose
stack is not a Vercel deployment. Vercel Hobby restricts use to personal,
non-commercial projects; check the account's plan before a school launch.

A **4 vCPU / 8 GB RAM** backend server is an initial small-pilot planning estimate,
not a capacity guarantee. Load-test logins, API traffic, scans, jobs and backup
peaks before production. A single server does not provide high availability.
Hosting the web interface on that server is also supported and can avoid a
separate frontend hosting subscription. No paid resource was created here.

The current Neon database remains development data pending a reviewed migration
and cutover decision. Choose school-approved locations for the database, private
documents and independent encrypted backups. Do not infer India-only residency
from the existing Singapore development database or from a Vercel frontend.

References checked 2026-10-20:
- https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/i/which-platform-should-host-your-docker-app
- https://docs.goauthentik.io/install-config/install/docker-compose/

## Pending choices and acceptance

1. Hosting budget, approved data location, always-on server and responsible operator.
2. Domain/DNS ownership and trusted HTTPS application, API and identity names.
3. Verified administrator email, recovery contacts and encryption-key custodian.
4. Private document storage, independent backup destination, retention and recovery
   objectives, monitoring and alert destination.

Review the private draft without contacting any external service:

```powershell
npm run school:readiness -- backups/onboarding/sunrise-public-school.json backups/onboarding/sunrise-readiness.json
```

Exit code 2 means missing decisions/evidence; expected while the draft is incomplete.
Reports use exclusive creation; choose a new output name on subsequent reviews.
The checker prepares disabled OIDC request metadata only once configuration is
complete. JIT and SSO enforcement start off. It performs no remote writes and
does not independently verify operator attestations or approve go-live.

Use the existing Super Admin school-creation endpoint after checking for an
existing `DEMO001`. Supply the initial administrator password through the secure
administrative form/secret channel; prepared metadata deliberately omits passwords.
The current API needs both `adminEmail` and `adminPassword` to create that account.
Do not seed real deployments with demo users or reuse development credentials.

Deploy the base ERP Compose with the cloud overlay, and a dedicated per-school
identity project with the production Authentik overlay. Apply migrations and prove
the non-owner RLS runtime role before starting the API. Enroll administrator MFA,
configure independent recovery access and test a single pilot user before bulk
SCIM provisioning or enforcing SSO.

Every production gate needs actual evidence: trusted TLS/renewal, load/capacity,
tenant isolation, document scanning/private access/retention, independent backups,
database/document/identity restore, signed OIDC/replay denial, MFA/recovery,
wrong-school/domain denial, JIT/unassigned-user denial, SCIM lifecycle/session
revocation, dual-control emergency access, monitoring and school-owner acceptance.
SAML needs separate acceptance if required by the school.

Acceptance entries take this form; leave them null until exercised:

```json
{
  "passed": true,
  "environment": "production",
  "schoolCode": "DEMO001",
  "operator": "actual responsible operator",
  "reference": "actual test report or change ticket",
  "verifiedAt": "actual ISO timestamp"
}
```

## Vercel integration checks before deployment

- Use the `apps/web` workspace, include the shared workspace outside its root,
  and build `packages/shared` before the web workspace.
- Run lint and type checks explicitly. Current Next.js config ignores build-time
  type errors, so a successful build alone is insufficient acceptance.
- The rewrite expects `INTERNAL_API_URL` as an origin without `/api/v1`. Some
  server-side clients currently interpret it as a full API base URL. Normalize
  and exercise those paths during integration before releasing to Vercel.
- Set the approved HTTPS API destination, exact CORS origins and exact callback
  URLs. Verify cookie refresh and SSO in a real browser. A deployed frontend must
  not depend on localhost or a temporary tunnel to this laptop.
- Database, signing, storage and backup credentials must never be `NEXT_PUBLIC_*`.

No Vercel project, DNS record, cloud bucket or production host was provisioned.
