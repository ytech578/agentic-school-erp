# Production readiness: current staging evidence and remaining gates

Status: **not approved for production**. This is an evidence review, not an entire
project re-audit or authorization to change production access/data. Earlier dated
documents are historical snapshots; use the latest acceptance records below.

## Accepted staging work

- ERP password/MFA and DEMO001 non-admin pilot OIDC/MFA browser login passed.
- Authentik encrypted backup, same-host restore and restored administrator MFA
  login passed. The first daily 03:00 IST identity backup was accepted separately.
- Neon encrypted backup and same-host isolated restore matched all 76 tables;
  initial and automatic failure-alert delivery passed.
- The first **timer-triggered** Neon backup, due 15 November at 02:00 IST, is now
  accepted retrospectively. The exact journal invocation, successful exit and
  authenticated archive match. Fresh GETs of the encrypted archive and manifest
  matched their full checksums; the subsequent hourly monitor reported healthy.
- Three independent Google HTTPS checks, seven permanent alert policies and the
  five-minute backup-health reporter are live. All three failure and three
  recovery emails were confirmed; disposable monitoring fixtures were removed.
- Backup schedules remain enabled with **no automatic deletion**. No new backup,
  live restore, credential change or application restart was performed by this review.

These are staging results. They must not be relabelled as production acceptance.
The 169 operations tests passed during monitoring acceptance; they do not establish
live school authorization, recovery objectives or enterprise-wide acceptance.

## Order of remaining work

| Priority | Work | Completion evidence / decision needed |
| --- | --- | --- |
| 1 | Genuinely separate-host recovery | Independent Linux host and Docker-daemon proofs; approved ciphertext transfer and separate operator key handoff; authenticated restore, volume/table verification, cleanup and measured recovery time |
| 2 | Full ERP recovery, not only database contents | Recreated restricted roles/grants and ownership, RLS isolation, application encryption/signing/MFA keys, private document recovery and restored-application login against an isolated copy |
| 3 | Provider PITR and data-loss objective | Verify the current Neon plan/history; perform an isolated provider restore. Daily logical dumps do not meet the documented 15-minute database RPO or establish 35-day PITR retention |
| 4 | Enterprise security acceptance | School-scoped RLS and transactional-audit checks; wrong-school/unassigned/JIT denial; SCIM deactivation/session revocation; dual-control break-glass; private documents, malware quarantine and retention/legal-hold workflows |
| 5 | Capacity and operations | Approved synthetic load window and measurements; backup size/disk alerts; patch review; origin-certificate expiry/renewal; explicit RPO/RTO, retention and incident ownership |
| 6 | Real-school production approval | Approved data location, school-owned email/admin/recovery contacts, key custodian, operating budget, production domains/configuration and named school-owner go-live approval |

Security tests that change identities, grants, accounts, retention or sessions need
the exact test-account scope and approval. Do not use real student/parent accounts,
send real notifications or run load against staging without an agreed window.
No paid host, provider upgrade or new public recovery portal is authorized here.

## Read-only laptop assessment

The operator chose assessment of this laptop, not installation or a recovery run.
Windows reported 15.31 GiB usable RAM and **1.93 GiB free**. Only the stopped
`docker-desktop` WSL 2 distribution is installed; Docker's local daemon is unavailable.
There is no ordinary Linux distribution with verified systemd. No `.wslconfig`
resource-limit file was present. Free storage was approximately 49.10 GiB on C:
and 125.01 GiB on D:. No service was started, setting changed or key copied.

The existing Authentik second-host helper requires Linux/Docker/systemd, at least
2 GiB available for data-only recovery and 3 GiB for a later private login exercise.
It refuses the same host or source Docker daemon. This laptop is **not ready**;
its independence is not yet accepted merely because it is physically outside GCP.

A possible next step, requiring approval, is to prepare a normal Ubuntu WSL 2
distribution with bounded resources after freeing sufficient Windows memory.
Microsoft documents systemd support in WSL; Docker documents integration with
ordinary WSL distributions. Verify those capabilities and mount/ownership behavior
before transferring any live backup. Keep Docker Desktop's internal distribution
unchanged. Starting Docker can resume existing local containers, so inventory and
memory safeguards are required; do not start it while memory is this constrained.

First free memory and approve the exact Linux/Docker preparation. Only after a
key-free preflight passes should the operator approve a particular encrypted
archive/manifest transfer and **separate private recovery-key handling**. Never
place the key in chat, source control, Cloud Shell, R2 or a shell command.

## Evidence

- `backups/onboarding/staging-neon-first-scheduled-run-20261115.json`
- `backups/onboarding/recovery-laptop-assessment-20261117.json`
- `backups/onboarding/staging-external-monitoring-activation-20261116.json`
- VM: `/var/lib/school-erp-neon-backup/first-scheduled-run-acceptance-20261117.json`

The original school onboarding draft still has incomplete configuration/production
attestations. Its checker correctly returns `goLiveApproved: false`. Do not fill
missing fields with staging observations or mark all gates failed merely because
that older draft was not updated: use this evidence matrix to distinguish accepted
staging work from genuinely outstanding production decisions and tests.

References: [Microsoft WSL systemd](https://learn.microsoft.com/en-us/windows/wsl/systemd),
[Docker Desktop WSL integration](https://docs.docker.com/desktop/features/wsl/).
