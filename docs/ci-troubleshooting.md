# CI checks and local verification

## Failures investigated on 2026-10-20

The original push at `427f699` failed in API lint with exit code 2 because ESLint
reported unused bulk suppressions. Its 351 warnings were not the failure trigger.
The suppression counts must be pruned after previously suppressed violations are
fixed. The follow-up commit `e996e06` cleaned this baseline; GitHub then passed
API/web lint, all workspace type checks, migrations/RLS and the security audit.

The next job exposed a separate coverage failure: all 668 tests in 78 API suites
passed, but function coverage was 44.42%, below the configured 45% minimum.
Passing tests alone does not imply passing the coverage gate.

Regression tests now exercise emergency-access dual control, duplicate request
locking, approval races, expiry/revocation, transactional audit calls/failures and
school-specific reference-cache resolution/invalidation. Local full coverage
passed with 694 tests in 80 suites and 45.99% function coverage. Existing coverage
thresholds, lint rules and enforcement remain unchanged. This is local evidence;
the changed files must be pushed for a new GitHub-hosted result.

Original runs:
- https://github.com/ytech578/agentic-school-erp/actions/runs/39413070548
- https://github.com/ytech578/agentic-school-erp/actions/runs/39437752186

## Before pushing

From the repository root, install dependencies with `npm ci` when needed, then:

```powershell
npm run ci:verify
```

This builds the shared workspace, checks API/web lint and workspace types, runs
operational tests, enforces the API coverage thresholds and runs web tests.
It does not start Docker, apply database migrations, perform API integration
tests or build the final deployment images. Those are additional CI jobs.

If ESLint reports stale suppressions after fixing existing violations:

```powershell
npm run lint:prune
git diff -- apps/api/eslint-suppressions.json apps/web/eslint-suppressions.json
npm run ci:verify
```

Review and commit the reduced suppression baseline with the fix. Do not regenerate
all suppressions to conceal new violations, disable the lint gate, or lower
coverage merely to get a green check. Existing warning/suppression debt still
needs incremental cleanup; a passing gate is not a claim of zero warnings.

For API startup tests use a disposable database and Redis, apply migrations there,
and set `APP_RUNTIME_ENV_ONLY=true` so the developer `.env` is not loaded.
Never aim migration, restore or integration tests at the active Neon database.
The workflow provisions its own test database and Redis for this purpose.
