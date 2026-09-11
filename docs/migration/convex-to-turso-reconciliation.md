# Convex → Turso Reconciliation (Phase 3 definition)

No production migration occurs in Phase 3. When a future cutover is planned,
these checks gate it. Any mismatch is a migration failure — investigate,
never hand-edit the target to match.

## Count checks (source vs target)

- [ ] user/profile counts (Convex `users` ↔ Turso `profiles`, via identity map)
- [ ] transaction counts
- [ ] transaction status distribution matches per status (16 states)
- [ ] payment intent counts per status
- [ ] delivery counts per status
- [ ] dispute counts per status
- [ ] settlement totals per status (amount sums in minor units)
- [ ] refund totals per status (amount sums in minor units)

## Money checks

- [ ] per-transaction totals equal across systems (amount/delivery/platform/total)
- [ ] every ledger journal balances (sum debits == sum credits per journal)
- [ ] ledger account balances reconcile (custody asset vs buyer payable vs fees)
- [ ] no REAL/FLOAT columns hold money (schema inspection)
- [ ] all money values within Number.MAX_SAFE_INTEGER

## Integrity checks

- [ ] orphan detection: participants/items/media/history/evidence/messages
      referencing missing parents = zero
- [ ] missing references: every FK resolves
- [ ] public-reference uniqueness holds (no collisions in mapping)
- [ ] invite-slug uniqueness holds
- [ ] provider event IDs unique (no double-processed webhooks)
- [ ] idempotency keys unique per scope
- [ ] at most one PAID settlement per transaction
- [ ] at most one OPEN dispute per transaction
- [ ] audit trail continuity: every migrated transaction has a history chain
      starting at its creation state

## Process gates

- [ ] export artifact is explicit, versioned, and checksum-recorded
- [ ] no PII migrates beyond the approved mapping (emails/phones only where
      the target schema models them; no tokens/secrets/hashes)
- [ ] dry-run reconciliation passes twice on staging before any cutover talk
- [ ] rollback plan documented (Convex remains runnable until cutover criteria
      R46/R47 are met)

## Phase 5 exact process (development)

1. **Before snapshot** — record Turso row counts per table (or keep the fresh
   migrated file empty and note it).
2. **Import** — explicit artifact file → `importArtifact` with
   `{ dryRun: true }` first (planned counts, zero writes), then
   `{ dryRun: false }` on a non-production target. Rerun-safe via stable IDs
   + INSERT OR IGNORE; OTP rows and journal-less ledger entries skipped by
   policy with warnings.
3. **After snapshot** — `buildTursoSnapshot` + `normalizeConvexSnapshot` on
   the same artifact.
4. **Comparison** — `compareParity`; require zero findings for covered
   entities before any cutover discussion. Full command:
   `SHADOW_READ_MODE=compare npm run shadow:compare -- --artifact <file> --db <file:…>`.
5. **Failure handling** — per-entity triage per the runbook
   (`docs/migration/read-parity-runbook.md`); fix fixtures/mappers, never
   the comparator and never by hand-editing either database.
6. **Zero-write-to-Convex guarantee** — parity/import modules contain no
   Convex client, no deployment URL, and no credentials; enforced by code
   inspection (no such imports exist) and by running against local files.
