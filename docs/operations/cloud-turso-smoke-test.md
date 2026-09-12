# Cloud Turso Smoke Test (operations)

Status: tooling ready, NOT EXECUTED (no credentials in any environment).

## Command

```bash
TURSO_ENVIRONMENT=development \
TURSO_DATABASE_URL='libsql://...' \
TURSO_AUTH_TOKEN='...' \
npm run turso:smoke
```

`server/db/smoke.ts` implements the checks; `resolveSmokeTarget` is the
gatekeeper.

## Classification gate

- `TURSO_ENVIRONMENT` must be exactly `development` (case/space tolerant).
- Anything else — production, staging, empty, ambiguous — refuses BEFORE
  any connection attempt. Environment is never inferred from hostnames.

## What the smoke test verifies (read-only or rolled back)

1. Connection + `SELECT 1`.
2. Migration table presence and applied-vs-file counts.
3. `PRAGMA foreign_keys` enforcement readback.
4. FK rejection (violating insert inside a rolled-back transaction).
5. STRICT rejection (TEXT into INTEGER, rolled back).
6. Interactive transactions (TEMP table, session-local, auto-cleaned).
7. Schema presence spot-checks.
8. Append-only trigger inventory (>= 12).

It never seeds, never deletes unknown data, and prints counts only (the
target URL is redacted at `@` if a token were ever embedded — tokens travel
via `TURSO_AUTH_TOKEN`, never the URL).

## Cutover relevance

A passing development smoke test is necessary but not sufficient for
cutover: it proves engine behavior on Turso cloud, not data reconciliation
(see `docs/migration/convex-to-turso-reconciliation.md`), auth production
readiness, or ops review. Production smoke testing is a separate,
explicitly authorized operation with its own runbook (not this file).
