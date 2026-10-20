# School-controlled and cloud-hosted ERP deployments

Decision confirmed with the project owner on 2026-10-19: Authentik is the
selected identity provider. Some schools need their own local servers; other
schools may use hosted storage. These are separate deployment boundaries, not
an automatic per-request switch between a central cloud database and arbitrary
school file servers.

| Component | School-controlled installation | Cloud-hosted installation |
| --- | --- | --- |
| ERP application | School server / school-approved private infrastructure | Managed application host |
| Database | Local PostgreSQL with a non-owner RLS runtime role | Approved-region PostgreSQL, currently Neon for development |
| Documents | Persistent school-controlled filesystem; no public file serving | Private S3-compatible object storage; no public bucket/CDN for student records |
| Authentik | School-controlled identity instance and database | Prefer dedicated school identity instance/database/secrets on an approved host |
| Backups | Encrypted second device/site approved by school; offsite/cloud only with consent | Independent encrypted recovery destination and provider recovery history |
| AI and integrations | Disabled or separately approved; local firewall/egress rules required | Institution-approved external services and data-handling terms |

## What is implemented

- One maintained application codebase, separate environment/deployment profiles.
- `ERP_DEPLOYMENT_MODE=on-premises` rejects Neon and unapproved database hosts,
  requires local document storage, and rejects configured external Gemini access
  without explicit school approval.
- `ERP_DEPLOYMENT_MODE=cloud` requires configured object storage rather than
  treating a workstation uploads directory as production cloud storage.
- Production cannot run with the development deployment policy.
- Compose overlays: `infrastructure/deploy/on-premises.compose.yml` and
  `infrastructure/deploy/cloud.compose.yml`. Both passed syntax validation with
  dummy configuration. They have NOT been deployed or accepted as production.
- Cloud overlays require Docker Compose 2.24.4+ and do not start the local
  PostgreSQL/PgBouncer services by default. Current development is unchanged.
- Private file handling rejects path escapes, unexpected buckets and untrusted
  object URLs. Configured cloud storage does not silently fall back to a PC.

## How to onboard a school

1. Record deployment mode, school data owner, approved physical/cloud region,
   retention policy, recovery objectives, support access and AI/integration consent.
2. Choose server capacity, domain and trusted TLS certificates. Never expose
   PostgreSQL, Redis or an unauthenticated file share on the public Internet.
3. Provision the database as an operator, apply migrations and configure the
   non-owner runtime role BEFORE starting the application. Do not seed demo users
   into a real school's database.
4. Configure persistent documents, required scanning, Authentik and private access.
5. Set up school-approved backup and audit destinations, encryption-key custody,
   monitoring, alerts and an operator runbook. An extra folder on the same disk
   is not a disaster-recovery copy.
6. Exercise login/MFA, provisioning/deprovisioning, tenant isolation, document
   authorization, retention/hold races and isolated restore before acceptance.

For onsite installations, use school-owned DNS and certificates trusted by all
managed devices. For remote access use an approved VPN or authenticated ingress.
Do not make the cloud ERP fetch arbitrary URLs from schools' internal networks.
Optional central fleet reporting must be explicitly scoped and must not silently
replicate learner records from an onsite school.

## Current development boundary

The existing ERP remains on Neon with local documents, in development mode.
No school was moved back from Neon, no documents were uploaded to a new service,
and no cloud-storage account was created. Neon Singapore is not an India-only
hosting promise. A local-files/cloud-database development setup must not be sold
as a fully onsite installation.

The mode guard checks configuration, not every possible network path. Strict
onsite data residency also requires network egress control, school-managed DNS,
encrypted disks, reviewed SMTP/AI/push/telemetry integrations and tested operations.
This work does not add a local LLM provider; fully offline agentic AI needs a
separate implementation and acceptance test. School-controlled storage alone
does not make an external Gemini call local.
Changing an established school's mode is a planned database AND file migration,
with explicit approval, checksums, key transfer, cutover and rollback—not a UI toggle.

## Remaining decisions

- Local testing first is confirmed. The synthetic ERP API, identity database and
  separate test cache are initialized; Authentik is running. Signed OIDC, TOTP
  recognized by ERP, missing-MFA/replay denial and worker-driven Users lifecycle
  passed against synthetic data. The production identity TLS package is prepared,
  not deployed. See its README for test commands and remaining acceptance gates.
- An always-on production server/domain with adequate capacity for Authentik.
- For cloud schools: choose an allowed region and create private object storage
  with budget limits/alerts; do not activate public buckets or billing blindly.
- For onsite schools: identify the actual server, backup device/second approved
  location, certificate authority, firewall and school operator.
- Establish independent backup/audit monitoring; the Windows job needs this PC
  signed in, Docker and connectivity, so it does not provide cloud availability.

See `infrastructure/authentik/README.md` for identity setup and the recovery
status document for what has actually been tested.
