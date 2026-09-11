# Turso Development Architecture (Phase 3 foundation)

Status: foundation only — parallel scaffolding, zero traffic moved.

## Where things stand

- React currently remains on Convex (working app, untouched by Phase 3).
- Turso/libSQL is being introduced incrementally under `server/`:
  env resolution → client factory → versioned migrations → repository
  contracts → (later) services → (later) Node API → gradual cutover.
- The future Node API owns authorization and database access. No live-money
  readiness is claimed by anything in this document.

## Engine facts

- **Turso is SQLite/libSQL-compatible, NOT MySQL.** SQL is portable,
  conservative SQLite: explicit types, foreign keys, CHECKs, UNIQUEs,
  partial unique indexes. No stored procedures, no proprietary extensions.
- **Repository abstraction enables future PostgreSQL migration.** UI and
  (future) services depend on `server/repositories/interfaces/*`; only
  implementations and migrations are engine-specific.
- **No direct browser database access.** `openDatabase` throws in browsers;
  `TURSO_*` credentials are server-only (never `VITE_*`); no `@libsql`
  imports exist under `src/`.

## Conventions (decided, tested)

- **IDs:** UUID v4 TEXT primary keys (`crypto.randomUUID`); human public
  references (`dex_<time><rand>`, UNIQUE); 96-bit CSPRNG invite slugs
  (UNIQUE, never derived from internal IDs). See `server/domain/ids.ts`.
- **Timestamps:** INTEGER milliseconds since epoch (UTC), always
  server-generated for authoritative events. Sortable, portable to
  PostgreSQL `bigint`, no browser-clock trust.
- **Money:** INTEGER minor units everywhere; `REAL/FLOAT/DOUBLE` banned for
  authoritative currency (schema inspection test enforces). JS boundary
  guard: integers only, `<= Number.MAX_SAFE_INTEGER`, product ceiling
  ₦10,000,000 / floor ₦50 (`server/domain/money.ts`).
- **STRICT tables: used.** Verified against the bundled engine (SQLite
  3.45.1): STRICT rejects TEXT/REAL/BLOB in INTEGER columns (the money
  direction that matters) and enforces NOT NULL. Documented limits: STRICT
  still accepts numbers into TEXT columns and ignores VARCHAR length caps —
  app-level validation covers those; STRICT is defense-in-depth, not the
  whole story.
- **Foreign keys:** `PRAGMA foreign_keys = ON` on every connection, verified
  by readback + negative tests (never assumed).
- **Migrations:** ordered `NNN_name.sql`, `_schema_migrations` tracking with
  SHA-256 checksums; atomic apply; no rerun; checksum drift = loud failure.
  Explicit command only (`npm run migrate`) — startup never auto-migrates
  production. Seeds live in `server/db/seed/` and refuse production.
- **Ledger honesty:** SQLite cannot defer a multi-row balance CHECK, so
  journal balance is an atomic service-layer validation (documented in the
  `LedgerRepository` contract), with schema enforcing parent/account/
  amount/direction. No fake declarative balance constraint.

## Modes

- Dev/test: `:memory:` (default), `file:` URLs, or a Turso cloud dev DB via
  `TURSO_DATABASE_URL` (+ token). Production with anything but cloud config
  fails closed — tested.
- Cloud-Turso connectivity from this environment is **unverified** (no
  credentials present); all Phase 3 validation ran against local libSQL.

## What is deliberately NOT here yet

Node API, repository implementations, services, frontend cutover, real
payments/settlements/KYC, provider execution, production data. See the
gap analysis for phase mapping.

## Phase 3A hardening notes (frozen with the baseline)

- **Invite entropy: 128 bits.** `invite_slug` is 32 lowercase hex chars from
  CSPRNG, never derived from IDs/timestamps/references. `newInviteSlug`
  rejects anything else.
- **Identifier vs capability vs identity.** `public_reference` is a safe
  search/display identifier; `invite_slug` is the high-entropy invitation
  capability; internal UUID is the private database identity. Authorization
  must never rely on mere possession of `public_reference` — invite lookup
  returns minimum safe fields, and all consequential actions re-authenticate
  and re-authorize server-side (enforced in services from Phase 5 on).
- **Payment-intent retries allowed.** `transaction_id` is NOT unique in
  `payment_intents`: failed attempts retry with a fresh idempotency key
  (UNIQUE per `(transaction_id, key)`), provider switches get new intents,
  `provider_reference` stays globally UNIQUE. Duplicate financial *effects*
  are blocked by event/idempotency uniqueness, not by limiting attempts.
- **Webhook scoping.** `provider_webhook_events` is UNIQUE on
  `(provider, provider_event_id)` — event IDs are namespaced per provider,
  never assumed globally unique. `payment_events` dedupes per
  `(payment_intent_id, provider_event_id)` for the same reason.
- **Immutable vs stateful tables.** Fully immutable (BEFORE UPDATE/DELETE
  ABORT triggers, migration 011): `ledger_transactions`, `ledger_entries`,
  `audit_logs`, `payment_events`, `transaction_status_history`,
  `delivery_events`. Stateful by design (transitions tested): webhook inbox
  (RECEIVED→PROCESSED), OTP rows (attempts/use), notifications (read_at),
  disputes/settlements/refunds (status workflows).
- **Message trust.** `sender_id NULL` marks SYSTEM/ trusted event types, but
  NULL alone is NOT proof of trust — only trusted server services may create
  non-USER types. The future API must reject privileged message types from
  ordinary participants (no API exists yet to get this wrong).
- **Money ceiling.** ₦10,000,000 per transaction is a business/risk ceiling
  far below `Number.MAX_SAFE_INTEGER` (technical guard); the JS limit is
  never the product limit. The ceiling is centralized in
  `server/domain/money.ts` and may become configurable later.
- **Concurrency backstop.** UNIQUE/partial-UNIQUE constraints (dup PAID,
  dup idempotency, dup webhook, one OPEN dispute — all race-tested) are the
  final defense. Services must never rely on SELECT-then-INSERT alone.
- **Migration freeze rule.** Migrations 001–011 are the immutable baseline
  once Phase 3A is committed. All future schema changes use 012, 013, … —
  never edits to committed files (checksum enforcement makes edits fail
  loudly anyway).
- **Cloud-Turso gate (UNVERIFIED).** No credentials exist in this
  environment, so cloud behavior is unproven. Before any traffic cutover,
  a cloud-development smoke test MUST pass: connection, migrations,
  foreign keys, STRICT behavior, interactive transactions, and the
  concurrency races above.
