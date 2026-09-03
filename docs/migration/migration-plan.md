# DealSure — Migration Plan: Convex → Supabase/PostgreSQL

Controlled, phased migration. **Convex is not removed until Phase 17.** Each
phase ends with: applicable Prudence skill re-run, tests/lint/typecheck/build,
security & design impact notes, and documentation updates.

Branch: `architecture/supabase-migration`. Commits by logical responsibility
(never one giant commit).

## Phase 0 — Baseline (DONE 2026-09-03)

- [x] Repository audit (`docs/architecture/current-system.md`)
- [x] Convex inventory (`docs/migration/convex-inventory.md`)
- [x] Baseline checks recorded: typecheck PASS; lint FAIL (90 errors /
      20 warnings); build PASS; npm audit 8 vulns (2 critical — undici no
      fix, @convex-dev/auth→@auth/core); zero tests.
- [x] Prudence skills located & inventoried (`docs/prudence/*`).
- [ ] **Fix CRITICAL finding before proceeding**: hardcoded email API key in
      `src/convex/auth/emailOtp.ts` → move to `process.env` (see
      `docs/security/pre-migration-security-review.md`).
- [ ] Decide freebuff-JWT bridge & `profiles.id = auth.uid()` questions
      (owner input).

## Phase 1 — Architecture documentation (this branch)

- [x] `docs/architecture/current-system.md`
- [x] `docs/architecture/target-system.md`
- [x] `docs/architecture/authentication-decision.md`
- [x] `docs/architecture/database-boundaries.md`
- [x] `docs/migration/convex-inventory.md`
- [x] `docs/migration/convex-to-postgres-map.md`
- [x] `docs/migration/migration-plan.md`
- [x] `docs/security/pre-migration-security-review.md`
- [x] `docs/design/design-review.md`, `docs/security/security-review.md`,
      `docs/legal-compliance-questions.md`,
      `docs/requirements-traceability.md`, `docs/prudence/*`

## Phase 2 — Supabase local environment & migrations

- [ ] `supabase/` CLI init; local stack up (db, auth, storage, edge
      functions); secrets in `.env.local` (gitignored).
- [ ] `.env.example` with placeholders (created in Phase 1 — keep current).
- [ ] First migration: extensions (`pgcrypto`, `pg_cron` or scheduled
      functions), schemas `public`/`internal`, `dealsure_owner` role.
- [ ] Reproducibility check: `supabase db reset` from scratch must recreate
      the whole DB.

## Phase 3 — Postgres schema

- [ ] Migration files per `convex-to-postgres-map.md` (tables, columns,
      constraints, indexes) — one logical commit per domain:
      identity → transactions → payments → ledger → delivery → disputes →
      settlement/refunds → notifications/ops → migration tables.
- [ ] `internal.transition_transaction(...)` + transition-map mirror of
      `ALLOWED_TRANSITIONS`; trigger-based history + audit append.
- [ ] Ledger balance trigger + partial-unique single-PAID-settlement index +
      refund ≤ total guard.
- [ ] `migration_identity_map` / `migration_record_map` tables.

## Phase 4 — Authentication integration

- [ ] Supabase Auth project config: email OTP, anonymous, TOTP MFA.
- [ ] Frontend `supabase-js` + SSR cookie session; auth pages re-pointed;
      `RequireAuth` reads session + `get_my_roles()`.
- [ ] `profiles` rows created on sign-up (trigger on `auth.users` insert).
- [ ] Freebuff-JWT bridge Edge Function (pending owner decision).
- [ ] **Prudence security skill re-run** (auth section). Fix hardcoded email
      key. Staff MFA enrollment.

## Phase 5 — RLS and grants

- [ ] All `public` policies + `internal` grants per `database-boundaries.md`.
- [ ] Automated RLS negative-test suite (the 12 cases).
- [ ] **Security skill re-run; CRITICAL/HIGH findings block next phase.**

## Phase 6 — Profiles/users

- [ ] Identity export → transform → load (identity map first).
- [ ] `profiles`, `user_roles`, `kyc_profiles`, `bank_accounts`,
      `terms_*` migrated; role mapping per authentication-decision.
- [ ] Reconciliation counts.

## Phase 7 — Transactions

- [ ] `transactions` + items/media/history/participants migrated.
- [ ] Read paths on Supabase (feature API modules); create/publish/accept/
      cancel via Edge Functions.
- [ ] Dual-run comparison of `detail` output vs Convex.

## Phase 8 — Delivery

- [ ] `deliveries`, `delivery_events` migrated; **OTP hashing** on import.
- [ ] Dispatch/confirm Delivery Edge Functions; atomic OTP verify (row lock).

## Phase 9 — Disputes

- [ ] Disputes, messages, evidence migrated; dispute evidence → private
      storage bucket.
- [ ] Dispute open/message/evidence/resolve Edge Functions.

## Phase 10 — Payments

- [ ] `payment_intents` migrated; `payment_events`/`provider_webhook_events`
      internal.
- [ ] Edge Function payment verify (server-side provider verification);
      webhook endpoint with signature verification + idempotency.
- [ ] **Security skill re-run** (webhooks, idempotency, replay, secrets).

## Phase 11 — Ledger / refunds / settlements

- [ ] Ledger tables migrated (append-only; balance verified).
- [ ] `internal.release_tx`, refund, settlement Edge Functions; automated
      ledger-balance tests; double-settlement and over-refund guards tested.

## Phase 12 — Storage

- [ ] Buckets + RLS; upload/download Edge Functions; size/MIME validation;
      signed URLs; migrate any existing media refs; flag unresolved URLs in
      reconciliation.

## Phase 13 — Realtime / notifications

- [ ] Realtime channels (transactions, deliveries, disputes, notifications)
      with RLS applied; frontend subscriptions via feature API modules.
- [ ] Notification creation moved server-side.

## Phase 14 — Admin operations

- [ ] Staff queries via functions/views; role grants; KYC approval; freeze/
      unfreeze; dispute resolution; audit viewer; MFA re-auth on sensitive
      actions; all actions audited.
- [ ] **Security skill re-run** (admin authorization, escalation).

## Phase 15 — Reconciliation

- [ ] Full reconciliation of every domain vs Convex export
      (`docs/migration/reconciliation-report.md` + JSON). Financial mismatch
      = migration failure.
- [ ] RLS negative tests re-run; payment tests; ledger balance; E2E flows.

## Phase 16 — Production cutover

- [ ] Final Convex export → staging load → rehearsal → authorization tests →
      payment tests → E2E happy path & dispute path.
- [ ] Traffic/configuration switch; Convex kept read-only (rollback form).

## Phase 17 — Remove Convex

- [ ] Verification period passes; Convex functions, auth, cron, and
      dependencies removed; `bunx convex dev --once` artifacts deleted.
- [ ] Final security review + full docs consistency pass.

## Standing gates (every phase)

- Prudence skills relevant to the phase are identified and applied first
  (see `docs/prudence/skills-used.md`).
- Tests / lint / typecheck / build green (or documented exceptions).
- Security findings graded CRITICAL/HIGH/MEDIUM/LOW; CRITICAL blocks
  production deployment.
- Documentation updated to stay consistent with the implementation.

## Migration data pipeline (scripts/migration/)

```
01-export-convex       # Convex export (dev deployment; prod snapshot at cutover)
02-validate-source     # schema/format validation of export
03-create-id-maps      # identity + record maps (never insertion order)
04-transform-users     # users/profiles/roles/kyc/bank/terms
05-transform-transactions
06-transform-payments
07-transform-delivery  # hash OTPs here
08-transform-disputes
09-transform-ledger
10-transform-storage   # media/evidence refs (only if storage exists)
11-load-supabase       # load into staging
12-reconcile           # counts + financial checks
13-report              # docs/migration/reconciliation-report.md + .json
```

Exports and snapshots are **never committed to Git** (add
`migration/exports/`, `*.dump`, `*.jsonl` to `.gitignore`).