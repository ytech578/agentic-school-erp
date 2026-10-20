# Enterprise security completion evidence — 2026-10-18

This records implemented and tested controls, not a blanket production approval.
No paid resources or unrelated application's Neon data were changed.

| Workstream | Implemented and verified | Remaining deployment boundary |
| --- | --- | --- |
| PostgreSQL RLS | Dedicated Neon ERP database; restricted pooled runtime role; startup privilege guard; two-tenant isolation and cross-tenant write denial tested live | Repeat deployment checks whenever credentials/schema/tenant policies change; protect owner credentials separately from API runtime in hosting |
| Enterprise identity | MFA login tested live; SSO OIDC/SAML endpoints and local MFA challenge; replay-safe exchange; SSO password enforcement; SCIM User CRUD/PATCH/PUT and raw protocol responses; session admin UI/API; recent-MFA privileged actions; dual-control expiring break-glass | Supply actual IdP tenant/client/certificates and provisioning credentials; live IdP sign-in/provision/deprovision acceptance remains unverified. SCIM Groups are not supported or advertised |
| Transactional audit | Before/after domain snapshots enforced by database triggers for domain tables, including raw SQL and child records; actor/tenant/transaction metadata; credential redaction; append-only events; rollback verified; domain-service audit records retained | Database triggers supplement service-level business descriptions; privileged DBA access still needs separate operational audit/export and retention ownership |
| Document security | Required live ClamAV; clean and standard antivirus test detection verified; quarantine/download gating; checksum-checked rescan; legal hold and extension-only retention UI/API; locked purge with retry on deletion failure | Uploaded objects remain on local storage. Provision private durable/versioned object storage and recovery replication before hosted production; select retention policy with the institution |
| Disaster recovery | Verified six-hour Neon restore history; consistent encrypted backups; actual daily Windows task tested; encrypted archive verification; isolated local restore with all 76 table checksums matching | No actual provider PITR restore drill, cross-region backup destination, upload replication, 35-day provider PITR, always-on backup host or external failure alerts. Neon Free plus this workstation does not meet the enterprise DR specification |

## Debugging fixes included

- An SSO-enforced tenant now rejects password login in the login flow, not MFA
  enrollment. Federation no longer marks MFA satisfied without verified proof.
- A pending SSO exchange stays available for the local MFA challenge, then is
  consumed once before issuing a session. Exchange input is runtime-validated.
- Provider partial edits no longer call `.partial()` on a refined Zod schema
  (which failed at runtime), inject create defaults, or accidentally reset SSO
  enforcement. Merged configuration is validated and secrets omitted from output.
- Session administration ignores stale responses after switching users and
  blocks revocation while the selected user's session list is still loading.
- SCIM unsupported operations fail explicitly; pathless activation changes work;
  deactivation revokes sessions in the same transaction.
- An unknown scanner response is not treated as clean. Cloud deletion failures
  are not silently converted into successful local deletions.
- Policy edits and purge serialize on document row locks; purge rechecks legal
  hold/expiry and uses the locked object's current storage URL. Failed storage
  deletion is left eligible for retry.
- DB snapshots redact nested secrets and survive neither a rolled-back business
  write nor an application-role deletion attempt.

## Verification results

- API: 75 passing suites / 652 passing tests; typecheck, production build and
  lint error checks passed (existing warnings remain).
- Database: clean migration-chain/RLS/schema-drift checks passed; separate live
  Neon tenant/audit probes and source checksum verification passed.
- Backup tooling: 6 Node tests passed across connection-readiness and encryption
  tests; real encrypted archive verification and 76-table local restore passed.
- Frontend: 7 passing suites / 47 passing tests; production build and typecheck
  passed. Lint reports existing warnings;
  warning totals do not establish that every unrelated module is production-ready.
- Live smoke checks: MFA login and logout revocation, security read endpoints,
  SCIM discovery/errors, real ClamAV clean and antivirus-test detection passed.

## Operator locations

- ERP frontend: `http://localhost:3000`; API health: `http://localhost:4000/api/v1/health`.
- School administrator: Settings → Security for account MFA/sessions, identity
  providers/provisioning and document/session operations.
- Cloud database: dedicated Neon project `quiet-frog-11450462`, `school_erp`.
- Local fallback connection: `LOCAL_DATABASE_URL` in ignored API environment.
- Backup configuration/recovery commands: `docs/neon-setup.md`.
- Verification evidence, encrypted archives and drill reports are under ignored
  `backups/`; no credentials are included in this report.

## Release decision

The application implementation and free-tier cloud database cutover have advanced
substantially. Do not label all five workstreams fully production-complete until
the external identity and disaster-recovery prerequisites above have been
provisioned and exercised. A paid AWS account is not required to keep using this
local-development/Neon setup, but the original enterprise recovery guarantees
must not be promised on the basis of it.
