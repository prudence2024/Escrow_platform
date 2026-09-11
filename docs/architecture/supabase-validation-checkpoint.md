# Supabase Validation Checkpoint (frozen reference)

Status: **VALIDATED — frozen reference/fallback architecture. No further
Supabase database work required unless explicitly requested.**

Branch: `architecture/supabase-migration`
Validated: 2026-09-11 against hosted DealSure development project
(`Dealsure_development`, West EU / Ireland region).

## Purpose

DealSure development/reference architecture on Supabase (Postgres 17 + RLS +
SECURITY DEFINER trusted layer). This branch is a viable
architecture/reference and fallback; it is NOT merged to `main` and does NOT
touch the separately-evaluated Turso startup implementation.

## Migrations applied (hosted development): 0001–0010

Local and remote migration histories match exactly
(`npx supabase migration list`: every local version has the same remote
version). Migrations 0001–0008 are frozen remote history and were not
modified during validation. 0009/0010 were added (never edited 0001–0008):

| Migration | Content |
|---|---|
| 0001 bootstrap | extensions, `internal` schema, `dealsure_owner` role, append-only audit |
| 0002 identity | profiles, user_roles, role helpers, terms, KYC, bank accounts + RLS |
| 0003 transactions | transactions domain, invite RPC, state machine, visibility helper + RLS |
| 0004 delivery | deliveries, delivery events, hashed OTPs (server-only) + RLS |
| 0005 disputes/notifications | disputes, messages/evidence, notifications + RLS |
| 0006 financial/internal | payment_intents (read-only), ledger (balanced, append-only), settlements, refunds, staff accessors |
| 0007 security hardening | PUBLIC EXECUTE revoked, anon table access removed, column-scoped updates |
| 0008 auth-schema access | USAGE on `auth` + EXECUTE on `auth.uid()/auth.role()` for `dealsure_owner` |
| 0009 re-assert | idempotent re-assert of 0008 (effective on self-hosted rebuilds) |
| 0010 membership | `GRANT authenticated TO dealsure_owner` — the fix that persists on hosted |

## RLS authorization suite: 7/7 PASS

`supabase/tests/rls_authorization.sql` run via psql against hosted
development inside a single rolled-back transaction (no permanent fixtures;
zero residue verified). Groups: seller-positive, stranger read-denial +
invite-hole closed, stranger write-denial (`insufficient_privilege`),
anonymous (tables blocked, invite safe-fields only, bad/settled slugs
empty), notifications (read-state-only + isolation), state machine (valid
transition works, invalid rejected, history + audit written), staff
least-privilege reads.

## Type generation

`supabase gen types typescript --linked -s public,internal` →
`src/lib/supabase/database.types.ts` (covers `public` + `internal`).

## Build / typecheck / lint

- `tsc --noEmit` / `tsc -b`: clean.
- `vite build`: succeeds (exit 0).
- `eslint .`: has **pre-existing failures outside this migration work**
  (Convex backend, UI components, pages — all untouched by this branch's
  database/types changes; generated types file is lint-clean).
- No unit-test runner is configured in the repository; the RLS SQL suite is
  the authorization test evidence and is not a replacement for
  application-level tests.

## Out of scope — explicitly NOT done

- No production Convex data migrated (development fixtures only).
- No live payment credentials configured.
- No merge to `main`; no contact with the Turso implementation.

## Architectural note — migration 0010 (READ BEFORE ANY PRODUCTION USE)

Migration 0010 grants PostgreSQL role `authenticated` to `dealsure_owner`
because direct custom grants on Supabase's managed `auth` schema
(`GRANT USAGE ON SCHEMA auth`, `GRANT EXECUTE ON FUNCTION auth.uid()`)
reported success but did not persist on the hosted project (auth-schema ACL
verified unchanged across sessions while ordinary writes persisted). The
membership solved the tested `auth.uid()` permission failure (`42501
permission denied for schema auth` in the SECURITY DEFINER helpers).

Verified effective privilege profile of `dealsure_owner` after 0010: USAGE
on `auth` true, CREATE on `auth` false, no SELECT/INSERT/UPDATE/DELETE on
`auth.users`, no ownership of Supabase-managed auth objects, NOLOGIN
unchanged.

However, this role-membership design creates privilege coupling between
`dealsure_owner` and Supabase's `authenticated` role: future grants to
`authenticated` flow to the trusted owner role. **If this Supabase
architecture is later selected for production, REVIEW THIS DESIGN AGAIN
before launch rather than blindly carrying it forward.** Re-verify after any
Supabase platform maintenance. This note is intentional; do not remove it
without that review.

## Remaining security notes (observations, not freeze blockers)

- `anon` retains EXECUTE on `public.get_my_roles()` (returns empty set
  without a JWT — no data exposure) and on three trigger-only helpers
  (`handle_new_auth_user`, `assign_default_roles`, `disputes_after_insert`,
  uncallable outside trigger context via Supabase default privileges).
  Candidates for a future least-privilege hardening pass; no active
  vulnerability demonstrated.
- Direct SQL inserts into `auth.users` in `supabase/seed.sql` and
  `supabase/tests/rls_authorization.sql` are **DEV TEST FIXTURES ONLY**.
  Production signup must use Supabase Auth APIs; never make manual
  `auth.users` inserts the application signup mechanism, and never modify
  Supabase-managed auth tables/columns/indexes for fixtures.
- No unit-test runner currently exists; add application-level tests before
  any production selection.
- `dealsure_owner` ↔ `authenticated` membership requires future production
  review (see architectural note above).
