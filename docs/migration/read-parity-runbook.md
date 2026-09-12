# DealSure Read-Parity Runbook (Phase 5)

Development-only workflow proving Convex ↔ Turso read parity. Convex is
authoritative throughout: parity tooling reads, compares, and reports. No
auto-repair, no reconciliation writes, no preference, no production data.

## Prerequisites

- Local Turso/memory database with migrations applied (`npm run migrate`).
- An explicit Convex export artifact (local JSON file). Never point tooling
  at a live deployment; exports are produced by a separate, authorized
  Convex export step and reviewed before use.
- Synthetic fixtures only (dev seed or controlled import).

## Concrete sequence

1. **Prepare Turso target** — fresh local file (delete any prior `parity.db`):
   `npm run migrate -- --db file:./parity.db`
2. **Dry-run import** — validate the artifact without writing (counts only).
   (Covered by `devImport.test.ts`; a CLI dry-run flag lands with the Phase 6
   import CLI if needed — until then, dry-run via tests or a tsx one-liner.)
3. **Import** — explicit artifact → Turso (idempotent reruns; OTP rows and
   journal-less ledger entries skipped by policy with warnings).
4. **After snapshot + compare** —
   `SHADOW_READ_MODE=compare npm run shadow:compare -- --artifact ./tmp/convex-dev-export.json --db file:./parity.db`
5. **Read the report** — MATCH counts plus findings:
   `MATCH`, `MISSING_IN_CONVEX`, `MISSING_IN_TURSO`, `FIELD_MISMATCH`,
   `MONEY_MISMATCH` (exact integers), `UNMAPPED_STATUS`, `ORPHAN_RELATION`.

## One-command rehearsal (synthetic fixtures only)

`npm run parity:rehearse [-- --db file:./parity-rehearsal.db]` runs the full
loop against the built-in rich fixture (16 states, retries, disputes,
refunds, settlements, roles): fresh local DB → migrate → import → both
snapshots → compare → JSON report (exit 1 on any finding). Default target
is git-ignored `./parity-rehearsal.db`; production environments refuse.

## Failure handling

- Any finding besides full MATCH blocks cutover talk for that entity.
- `UNMAPPED_STATUS` → extend the explicit status map (never silent equivalence).
- `MONEY_MISMATCH` → investigate source amounts; exact integers, no tolerance.
- `ORPHAN_RELATION` → fix fixture/export completeness, not the comparator.
- Checksum or schema errors → new migration/mapper version, never edits.
- Re-run from step 1 on a fresh file; reruns must not duplicate (idempotency).

## Guarantees

- Zero writes to Convex (tooling has no Convex client, no credentials).
- Shadow mode defaults `off`; production forces `off`.
- Differences never reach users (CLI stdout only, no request coupling).
- See `docs/migration/convex-to-turso-reconciliation.md` for cutover gates.
