# Enterprise follow-up — 2026-10-19

## Verified fixes and additions

- Neon backup DNS failure: Windows resolves the address for libpq while retaining
  the real hostname for SNI/certificate validation (`verify-full`, system CAs).
  No hardcoded IPs. Bounded transient retries create a fresh database snapshot;
  authentication/certificate failures do not get hidden by infinite retries.
- Existing 02:00 Windows backup task updated with three 10-minute retry intervals.
  Its actual run succeeded at 13:07 IST on 19 October. Backup-health checks were
  healthy; independent off-host copy remains false.
- New scheduled archive restored into an isolated local test database; all 76
  table counts/checksums matched. Source/live databases were not overwritten.
- Backup-health check covers missing, stale and corrupted archives and failed
  scheduled runs. Optional email alerts require an explicitly configured recipient
  and SMTP. No test email was sent. This is not independent external monitoring.
- Runtime-only environment generated, excluding owner, backup and audit-export
  credentials. The runtime entry point ignores the combined administrative `.env`.
  The running API was restarted with this environment, and absence of the owner
  and recovery variables was checked before startup.
  Host access to that administrative file still needs OS/secret-manager controls.
- Encrypted incremental audit exporter verified: 131 events exported without
  database writes, then zero duplicate events on the next run. It uses a completed
  transaction fence rather than an unsafe createdAt-only cursor. Archives and
  checkpoint are local under ignored `backups/audit`; off-host immutable archival
  and separate DBA monitoring are not yet provisioned.
- Private storage rejects unsafe paths/symlink escapes, unexpected buckets and
  untrusted legacy URLs. New cloud objects get private locators; failed cloud
  uploads do not silently fall back to this computer. Provider-neutral S3 settings
  support the existing adapter without requiring an AWS account.
- HTTP logging omits request query values and headers; credential/cookie/body
  redaction is configured as an additional safeguard.
- On-premises/cloud policy guards and Compose overlays prepared and validated.
- Authentik chosen; local testing first approved. Isolated identity DB and cache
  started; a separate restricted-role ERP test API uses synthetic schools only.
  Actual API acceptance passed: TOTP enrollment, mandatory MFA challenge,
  single-use recovery, SCIM create/replace/filter/deactivate/reactivate, cross-school
  denial, role-escalation prevention, access/refresh revocation and token revocation.
  Evidence: ignored `backups/identity/local-acceptance.json`.
- Authentik 2026.8.4 downloaded, pinned by digest and started successfully. Actual
  signed OIDC login passed with PKCE/state/nonce and denied callback/exchange replay.
  Real TOTP enrollment/login, missing-MFA-response denial and verified MFA AMR
  recognition in ERP passed. Worker-driven create/update/deactivate/session-denial/
  reactivate passed. Evidence: ignored `backups/identity/federation-acceptance.json`.
- Corrected a real IdP compatibility gap: ERP now parses `application/scim+json`,
  with six parser regression tests. User-only Authentik sync disables group
  discovery before mappings, skips group writes and maps active status explicitly.
  MFA precedes the provider login event; an authorization-flow policy rejects
  existing password-only sessions instead of inventing a verified-MFA claim.
- Development TLS trust is confined to test processes, with no system CA changes.
  A separate production HTTPS overlay (no bootstrap credentials or direct HTTP
  exposure) is prepared for either approved school-owned or future cloud hosts.
  Both nginx templates and identity Compose overlays passed validation.
- Operational regression checks rerun: 17 backup/audit/runtime/identity tool tests
  passed and added to CI. API: 78 suites / 668 tests passed. API typecheck/build
  and changed-file lint passed (partial lint ignores unpruned existing suppressions).
- The normal port-4000 ERP API was restarted with the restricted runtime environment
  to apply the SCIM parser fix. Both normal and synthetic test APIs returned health
  HTTP 200 afterward. No real identity-provider/user record was created or changed.

## What is still required

Verification: 78 API suites / 668 tests passed, plus 17 operational-tool tests.
API changed-file lint, typecheck and production build passed. Both deployment
overlays and the Authentik Compose file passed syntax/configuration validation;
this is not evidence of a live deployment. Current backup health is green.

Identity browser visual testing, school-specific negative domain/JIT cases, live
SAML (if required), real-school onboarding, separate identity backup/restore and
production load/availability acceptance still remain. The user selected local
testing first; no always-on cloud identity server/domain was provisioned.

See `docs/deployment-modes.md` for the confirmed storage architecture. No cloud
storage account exists, so no private bucket, object replication or independent
cross-region recovery is claimed. Fully onsite schools must not use Neon for
their records; actual school hardware, region/data policy, domains and backup
destination must be selected before migration/deployment. Cloud PITR restoration,
35-day retention and always-on monitoring remain unverified external requirements.

Existing development database and local files were left in place. No paid service,
public object bucket, external notification or unrelated project was created.
