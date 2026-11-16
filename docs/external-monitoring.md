# Independent staging monitoring

## Current status: live; staging monitoring acceptance completed (16–17 November 2026)

The owner re-enabled project billing. A fresh authenticated read confirmed
`billingEnabled: true`. The three permanent HTTPS checks and seven permanent
alert policies were created and read back in `agentic-school-erp-staging`, reusing
the existing enabled operator email channel. No IAM role, service-account key,
application configuration, backup schedule or recovery credential was changed.

| Signal | Check / alert configuration |
| --- | --- |
| ERP login | HTTPS `/login`, HTTP 200, every minute; alert after two locations fail for one minute |
| API/database | HTTPS `/api/v1/health`, HTTP 200 and `"status":"ok"`; same failure rule |
| Identity | HTTPS `/-/health/ready/`, HTTP 200; two failing locations for five minutes to tolerate the approved short backup pause |
| Neon / identity backup unhealthy | Separate exact-instance/workload policies: health value below 1 |
| Neon / identity heartbeat missing | Separate exact-instance/workload absence policies: no point for 15 minutes |

All HTTPS checks validate certificates, use ten-second timeouts and check from
Asia Pacific, Europe and US Oregon. Alert evaluation, ingestion and email delivery
add latency to the configured retest periods; these are not delivery-time guarantees.

The first genuine publisher run succeeded at `2026-11-16T18:18:14.741Z`.
Both real health signals were seeded again **after** policy creation, then the
five-minute `school-erp-external-monitor.timer` was enabled and became active.
The VM remains the signal publisher; Google owns the independent policy evaluator
and email delivery. This does not protect against a whole GCP account/project outage.

Three clearly labelled disposable fixtures tested failed HTTPS, an unhealthy backup
signal and an absent heartbeat without stopping the real ERP, publisher or backups.
The operator confirmed receipt of **all three failure emails**. Google subsequently
closed all three incidents naturally after only the test signals were restored:

| Disposable test | Opened (UTC, 16 November) | Closed automatically (UTC) |
| --- | --- | --- |
| Unhealthy backup | 18:23:23 | 18:29:48 |
| Missing heartbeat | 18:25:08 | 18:29:48 |
| Failed HTTPS | 18:24:43 | 18:31:07 |

At `2026-11-16T18:32:33.525076Z`, only the one disposable check and its three
policies were removed. Readback confirmed all three permanent checks and seven
policies were unchanged and enabled. Test incidents and non-secret time-series
history remain retained by Google; no backup or school data was deleted.
`OPENED` and `CLOSED` notifications are configured. The operator subsequently
confirmed the three recovery emails, including the final green recovered status.
Both failure and recovery delivery acceptance gates have therefore passed.

A subsequent automatic timer publication at `2026-11-16T18:25:47.952Z` was accepted
with both real values healthy. All five original services retained their start times
and restart counts, and all five backup/local-monitor/reporter timers were active.
The initial local test attempt encountered sandbox socket/ACL restrictions; the
authorized unrestricted rerun passed all **169/169** operations tests. No code fix
or weakened test was used.

Final health verification at `2026-11-16T18:34:06.354Z` again confirmed five unchanged
healthy services, five enabled/active timers and HTTP 200 for all three URLs. A
second subsequent automatic publication at `2026-11-16T18:30:52.902Z` also succeeded.

Evidence: `backups/onboarding/staging-external-monitoring-activation-20261116.json`
and the root-only VM receipt `/var/lib/school-erp-monitoring/completion-20261117.json`.
Earlier phase receipts are preserved, including their then-pending delivery state.
These records
do not establish separate-host recovery, PITR or overall production readiness.

## Historical billing blocker (14 November 2026; superseded by owner action)

The existing GCP project refused persistent uptime-check creation with:
`Project ... is not billable: This API method requires billing to be enabled.`
The backup-health publisher's actual write returned HTTP 403 / PERMISSION_DENIED;
a separate redacted diagnostic confirmed the provider message mentions billing.
An empty-payload diagnostic returned HTTP 400 and is not evidence of successful
metric publication. The reason the project's billing is disabled was not determined.
Do not infer expired trial credit or change a billing account without the owner.

No persistent uptime check, cloud alert policy, delivered cloud failure alert or
missing-heartbeat alert has been accepted. A passive Google email notification
channel for the existing operator was saved; no alert-delivery claim follows from
that channel's existence. The API test probe responded HTTP 200 in 731 ms before
the attempt to save its persistent check was rejected.

The reporter code, private non-secret configuration and systemd definitions are
installed on the existing VM. Unit syntax passed and all four file hashes matched.
Its first service run failed on the refused cloud write. The reporter timer remains
**disabled/inactive**, without automatic retries. Preserve this failed-attempt
evidence and reconcile existing paths; do not blindly rerun a fresh installer.
Existing Neon and Authentik backup/local-monitor schedules remain enabled/active.
All five live services remained healthy with unchanged IDs/start/restart counts.
No application was restarted, IAM permission granted, billing enabled, paid
resource provisioned, deletion enabled, or school record/recovery key transmitted.

Non-secret evidence:

- Local: `backups/onboarding/staging-external-monitoring-preparation-20261114.json`.
- VM: `/var/lib/school-erp-monitoring/preparation-20261114.json` (root-only).
- VM diagnostic: `/var/lib/school-erp-monitoring/metric-write-review-20261114.json`.

## Monitoring design

Google-managed HTTPS checks, independent of the ERP VM, should monitor:

1. `https://staging.agenticschoolos.in/login` (web access).
2. `https://staging.agenticschoolos.in/api/v1/health` (API/database readiness,
   HTTP 200 and healthy status content).
3. `https://auth-staging.agenticschoolos.in/-/health/ready/` (identity readiness).

Use normal TLS verification, bounded timeouts, and at least three checkers. Do not
add authentication secrets or school accounts to public uptime checks. Use a
multi-minute retest window for identity to tolerate its separately approved brief
backup sign-in pause; do not suppress prolonged outages or suspend its monitoring.

The separate `scripts/ops/external-backup-monitor.js` publisher evaluates the
existing authenticated-backup receipt health functions for Neon and Authentik.
It reads only source configuration, status, encrypted archives and manifests;
it does not decrypt a backup or read a database password, recovery key, R2 key,
SMTP password or school record. Malformed/missing/foreign data fails closed.
A RUNNING backup can use its still-healthy previous receipt for at most ten minutes;
failed/stale/unverified backups are never reported healthy.

Every five minutes, it sends two GAUGE/INT64 measurements to
`custom.googleapis.com/school_erp/backup_health`: 1 healthy or 0 unhealthy, labelled
only by fixed workload (`neon`/`identity`) and instance. No filename, hash, key,
row, diagnostic message or inventory is included. It uses the existing metadata
service-account identity and fixed, certificate-validated Google HTTPS destination;
no new downloaded service-account key or IAM fallback is implemented.

Cloud-side policies must alert on unhealthy values and on either signal missing
for 15 minutes. Use monitored resource `global`, not `gce_instance`: absence
policies can ignore terminated/deleted GCE resource metrics. Seed both signals
**after** policy creation and verify the policies actually evaluate; metric-absence
conditions require an initial point before absence can trigger.

The publisher needs the VM, but the policy evaluator and email delivery do not.
Therefore a stopped VM, stopped publisher or broken publishing permission should
cause the cloud-side absence alert. This is independence from VM failure, not a
guarantee against a whole GCP-project/account/provider outage.

## Deployment and acceptance procedure

1. Owner restores existing GCP billing (completed by the owner), or explicitly
   approves an alternative provider/account. Never silently enable billing or
   broaden cloud access.
2. Reconcile existing notification channel and source files to avoid duplicates
   (completed; the existing enabled email channel was reused).
3. Create the three HTTPS monitors and the unhealthy/missing-backup policies with
   the approved notification destination. Verify successful provider reads/writes
   (completed).
4. Run the constrained publisher, verify both genuine healthy measurements, then
   enable only its five-minute timer. Leave backup schedules and credentials alone
   (completed, including an automatically triggered subsequent publication).
5. Use a disposable monitor/heartbeat fixture to prove a missed signal and failed
   HTTPS response trigger external notifications. Obtain operator inbox confirmation.
   Do not stop the live ERP, VM or real backups to manufacture a failure (completed;
   all three failure emails confirmed by the operator).
6. Verify recovery notifications, fixture cleanup, ongoing successful checks,
   unchanged live service health and record acceptance separately (completed;
   all three recovery emails also confirmed by the operator).

All **169 operations tests** passed, including seven new publisher safeguards.
This local regression result is not a live cloud-alert or production acceptance.

## Cost and alternatives

Google publishes free usage allowances for uptime executions and custom-metric
ingestion, but an allowance does not remove the observed billing prerequisite or
guarantee no charge when shared limits/prices change. See the current
[Google Observability pricing](https://cloud.google.com/products/observability/pricing).
No paid monitoring resource was created during this attempt.

If the owner wants no GCP billing activation, an alternative is external HTTPS
checks through UptimeRobot plus missed-job/VM heartbeats through Healthchecks.io.
The official [UptimeRobot free-plan guidance](https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan)
allows business use with five-minute checks; [Healthchecks pricing](https://healthchecks.io/pricing/)
lists a zero-cost 20-job plan. New account setup, terms, private heartbeat URLs and
actual alert tests remain operator/approval gates, not completed deployments.

References:

- [Google public uptime checks](https://docs.cloud.google.com/monitoring/uptime-checks).
- [Google metric-absence semantics](https://docs.cloud.google.com/monitoring/alerts/metric-absence).
- [Google custom metric creation](https://docs.cloud.google.com/monitoring/custom-metrics/creating-metrics).
