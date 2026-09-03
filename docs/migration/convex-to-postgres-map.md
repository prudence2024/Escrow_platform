# DealSure — Convex → PostgreSQL Mapping

For every Convex collection: target table, columns, constraints, indexes,
RLS policy intent, server-only operations, transformation, and risk.
Generated from `docs/migration/convex-inventory.md` (2026-09-03).

## Conventions

- All business IDs become `uuid` PKs (`gen_random_uuid()`); `publicId`/`slug`
  stay as natural keys with UNIQUE constraints (they appear in public URLs).
- Money: `amount_minor bigint` + `currency char(3)` (NGN). **No floats.**
- Timestamps: `timestamptz`.
- Identity: external auth subject lives on `profiles` (see
  `authentication-decision.md`); business tables reference `profiles.id`.
- Two schemas (see `database-boundaries.md`):
  - `public` — exposed to the Data API, guarded by RLS.
  - `internal` — **not exposed** to PostgREST; server-only writes via
    SECURITY DEFINER functions / Edge Functions; read via narrowly granted
    views or functions.
- `migration_identity_map` / `migration_record_map` live in `internal`.

---

## IDENTITY

### users → profiles (+ auth users)

Convex `users` merges identity + role. Target splits it:

- **Supabase `auth.users`** — identity managed by Supabase Auth (replaces
  Convex auth tables). Not part of app schema.
- **`public.profiles`** — app-facing identity.

Columns: `id uuid PK default gen_random_uuid()`, `auth_provider text not null`
(`supabase` | `freebuff-jwt`), `auth_subject text not null`, `email text`
(normalised lowercase), `phone text`, `display_name text`, `full_name text`,
`country text`, `status text not null default 'ACTIVE'` (ACTIVE|DISABLED|
SUSPENDED), `onboarded boolean not null default false`,
`created_at/updated_at timestamptz`.

Constraints: `UNIQUE (auth_provider, auth_subject)`; `UNIQUE (email)` (partial
`where email is not null`).

RLS: `profiles` — select/update own row (`auth.uid() = id` via `id =
auth.uid()` if we adopt `profiles.id = auth.uid()`; **decision**: make
`profiles.id = auth.uid()` for Supabase Auth users so RLS is simple and
`auth.uid()` maps 1:1). Freebuff-JWT users get a profile row linked by
`(auth_provider, auth_subject)` with a distinct id and a JWT-sub claim
mapping — see authentication decision.

Server-only: `status` changes (disable/suspend), email changes.

Transformation: Convex `users._id` → `migration_identity_map` (old id →
profile uuid). `name` → `display_name`/`full_name`; `role` moves to
`user_roles`; `kycStatus` moves to `kyc_profiles`.

Risk: **HIGH** — every other table references users. Migration must run
identity map first and resolve every `sellerId`/`buyerId`/`actorId`.

### profiles → merged into `public.profiles` (above)

Convex `profiles` columns fold into the target `profiles` table. `termsVersionAccepted` → `public.terms_acceptances`.

### user_roles (new)

Columns: `id uuid PK`, `profile_id uuid not null → profiles(id) on delete cascade`, `role text not null` (buyer|seller|support_agent|dispute_agent|operations_admin|finance_admin|super_admin), `granted_by uuid → profiles(id)`, `granted_at timestamptz`, `revoked_at timestamptz null`.

Constraints: `UNIQUE (profile_id, role)`; `CHECK (role IN (…))`.

RLS: no direct user access (server-only read for `auth.uid()`'s own roles via
a SECURITY DEFINER function `get_my_roles()`); staff reads via staff policy.
Any user can be buyer + seller.

Server-only writes: `grant_role` / `revoke_role` (super_admin only), audited.

### kyc_profiles

Columns: `id uuid PK`, `profile_id uuid not null → profiles`, `status text not null default 'UNVERIFIED'` (UNVERIFIED|SUBMITTED|VERIFIED|REJECTED), `doc_type text`, `verified_at timestamptz`, `rejected_reason text`, `created_at/updated_at`.

RLS: select own; staff select all. Writes server-only (submission via Edge Function; approval via staff function).

### bank_accounts

Columns: `id uuid PK`, `profile_id uuid not null → profiles`, `provider text`, `account_name text not null`, `account_number text not null`, `bank_name text not null`, `bank_code text`, `status text not null default 'PENDING'`, `is_default boolean not null default false`, `created_at/updated_at`.

Constraints: `UNIQUE (profile_id, account_number)`; `CHECK (account_number ~ '^[0-9]{10}$')`.

RLS: select/update own rows; **account_number returned only to owner and staff** (avoid leaking full account numbers through detail queries where possible).

Server-only: verification status changes.

### terms_versions / terms_acceptances

`terms_versions`: `id uuid PK`, `version int not null UNIQUE`, `content text not null`, `effective_at timestamptz not null`.

`terms_acceptances`: `id uuid PK`, `profile_id uuid not null → profiles`, `version int not null → terms_versions(version)`, `accepted_at timestamptz not null`; `UNIQUE (profile_id, version)`.

RLS: read public terms; write own acceptances (insert-only policy).

---

## TRANSACTIONS

### transactions

Columns (mapped): `id uuid PK`, `public_id text not null UNIQUE` (dex_…), `slug text not null UNIQUE`, `status text not null CHECK (status IN (16 states))`, `seller_id uuid not null → profiles`, `buyer_id uuid → profiles`, `buyer_email text`, `buyer_phone text`, `title text not null CHECK (char_length(title) BETWEEN 3 AND 120)`, `description text not null CHECK (char_length(description) <= 4000)`, `category text not null CHECK (category IN (CATEGORIES))`, `condition text`, `amount_minor bigint not null CHECK (amount_minor >= 0)`, `delivery_fee_minor bigint not null CHECK (delivery_fee_minor >= 0)`, `total_minor bigint not null CHECK (total_minor = amount_minor + delivery_fee_minor)`, `fee_minor bigint not null CHECK (fee_minor >= 0)`, `fee_charged_to text CHECK (fee_charged_to IN ('buyer','seller','split'))`, `currency char(3) not null default 'NGN'`, `agreed_deadline_at timestamptz`, `inspection_window_days int not null default 3 CHECK (inspection_window_days BETWEEN 1 AND 30)`, `return_terms text`, `dispute_blocked boolean not null default false`, `released_at timestamptz`, `created_at/updated_at timestamptz`.

Also: `amount_minor`/`total_minor` limits → `CHECK (amount_minor BETWEEN 5000 AND 1000000000)` (₦50.00–₦10,000,000.00).

Indexes: `by_seller (seller_id, created_at desc)`, `by_buyer (buyer_id, created_at desc)`, `by_status (status, created_at desc)`, `by_created (created_at desc)`, unique `public_id`, unique `slug`.

**State machine at the DB level**: status transitions must not be writable
directly. A SECURITY DEFINER function `internal.transition_transaction(tx_id, to_status, actor_id, reason, extra jsonb)` validates against the transition map (mirror of `ALLOWED_TRANSITIONS`), updates the row, inserts
`transaction_status_history`, and appends `audit_logs` — all in one
transaction. Browser/Data-API paths get **no** insert/update grant on
`transactions.status`; Edge Functions call the function.

RLS: 
- SELECT: participant (seller, buyer, participant row) or staff, or
  authenticated holder of unguessable slug while status =
  `PENDING_BUYER_ACCEPTANCE` (reproduce `canViewTransaction`).
- INSERT: seller (via Edge Function create — or a narrow `(seller_id =
  auth.uid())` insert policy with fixed defaults via RLS `WITH CHECK`).
- UPDATE: no direct client update except staff freeze field via function;
  the transition function is SECURITY DEFINER so RLS does not block it.

### transaction_items

`id uuid PK`, `transaction_id uuid not null → transactions on delete cascade`, `name text not null`, `note text`. Index `by_transaction`.

RLS: SELECT with transaction visibility (join via
`transactions` visibility policy — implement as a helper function
`internal.can_view_transaction(tx_id)` used by policies). INSERT/UPDATE:
seller only (via create flow), enforced by function.

### transaction_media

`id uuid PK`, `transaction_id uuid not null → transactions cascade`, `storage_path text` (Supabase Storage path), `kind text`, `created_at`.

RLS: SELECT with transaction visibility; INSERT seller only. Media rows point
to private Storage objects — the URL is a signed URL generated server-side,
never a public path.

### transaction_status_history

`id uuid PK`, `transaction_id uuid not null → transactions cascade`, `actor_id uuid → profiles`, `from_status text`, `to_status text not null`, `reason text`, `at timestamptz not null default now()`.

RLS: SELECT with transaction visibility; INSERT **server-only** (the
transition function). No client insert/update grants.

### transaction_participants

`id uuid PK`, `transaction_id uuid not null → transactions cascade`, `profile_id uuid not null → profiles`, `role text not null`, `email text`, `accepted_at timestamptz`. `UNIQUE (transaction_id, profile_id)`.

RLS: SELECT with transaction visibility; INSERT server-only (buyer accept).

---

## PAYMENTS

### payment_intents

`id uuid PK`, `transaction_id uuid not null → transactions`, `payer_id uuid not null → profiles`, `provider text not null`, `provider_intent_id text`, `provider_event_id text UNIQUE`, `idempotency_key text not null`, `amount_minor bigint not null CHECK (> 0)`, `currency char(3) not null`, `status text not null CHECK (IN ('PENDING','SECURED','REFUNDED','FAILED','CANCELLED'))`, `raw_event jsonb`, `created_at/secured_at timestamptz`.

Constraints: `UNIQUE (transaction_id, idempotency_key)`.

RLS: SELECT to payer/participants/staff; **INSERT/UPDATE server-only** (Edge Function). Never client-writable.

### payment_events → internal.payment_events

`id uuid PK`, `payment_intent_id uuid not null → payment_intents`, `provider_event_id text not null UNIQUE`, `type text not null`, `raw jsonb`, `received_at timestamptz not null default now()`.

**Server-only, internal schema, not exposed.** Idempotency anchor: unique
`provider_event_id` — replay inserts fail/are ignored transactionally.

### provider_webhook_events (new)

`id uuid PK`, `provider text not null`, `provider_event_id text not null`, `event_type text not null`, `raw jsonb not null`, `signature_verified boolean not null default false`, `received_at timestamptz not null default now()`, `processed_at timestamptz`, `error text`.

`UNIQUE (provider, provider_event_id)`. **Server-only, internal schema.**

---

## LEDGER

### ledger_accounts → internal.ledger_accounts

`id uuid PK`, `code text not null UNIQUE`, `name text not null`, `type text not null CHECK (IN ('ASSET','LIABILITY','REVENUE','EXPENSE','EQUITY'))`, `currency char(3) not null`.

### ledger_transactions (new — grouping header)

`id uuid PK`, `ref_id text not null UNIQUE`, `transaction_id uuid → transactions`, `memo text not null`, `created_at timestamptz not null default now()`, `reversal_of_id uuid self-ref`.

### ledger_entries (append-only)

`id uuid PK`, `ledger_transaction_id uuid not null → ledger_transactions`, `account_id uuid not null → ledger_accounts`, `debit_minor bigint not null default 0`, `credit_minor bigint not null default 0`, `memo text`.

Constraints: `CHECK ((debit_minor = 0) <> (credit_minor = 0))` (exactly one
side non-zero); **no UPDATE/DELETE grants — ever**. Balance invariant: every
`ledger_transactions` row must satisfy `sum(debit) = sum(credit)` — enforced
by a trigger on insert + an automated test suite (Phase 11).

### Reversal model

Mistakes are fixed with a reversing `ledger_transactions` row whose entries
mirror the original and link `reversal_of_id`. No destructive edits.

**All ledger tables: internal schema, server-only, append-only.**

---

## DELIVERY

### deliveries

`id uuid PK`, `transaction_id uuid not null → transactions`, `courier_name text`, `tracking_number text`, `carrier_details text`, `dispatched_at timestamptz`, `delivered_at timestamptz`, `inspection_deadline_at timestamptz`, `status text CHECK (IN ('DISPATCHED','DELIVERED','CANCELLED'))`.

RLS: SELECT with transaction visibility; writes server-only (dispatch/confirm functions).

### delivery_events

`id uuid PK`, `delivery_id uuid not null → deliveries cascade`, `type text not null`, `actor_id uuid → profiles`, `at timestamptz not null default now()`, `note text`.

RLS: SELECT with transaction visibility; INSERT server-only.

### delivery_otps → internal.delivery_otps

`id uuid PK`, `transaction_id uuid not null → transactions`, `delivery_id uuid not null → deliveries`, `code_hash text not null` (**HMAC-SHA256 of the code with a server secret — never the raw code**), `expires_at timestamptz not null`, `attempts int not null default 0`, `consumed_at timestamptz`, `max_attempts int not null default 5`.

Constraints: `CHECK (attempts >= 0)`.

**Server-only, internal schema.** The raw code is returned once to the seller
at dispatch and stored only hashed. Verification happens in a SECURITY
DEFINER function that atomically checks `consumed_at IS NULL`, expiry,
attempt cap, and hash match, and increments attempts — race-safe via `UPDATE
… WHERE consumed_at IS NULL` row lock.

---

## DISPUTES

### disputes

`id uuid PK`, `transaction_id uuid not null → transactions`, `opened_by uuid not null → profiles`, `reason text not null`, `details text`, `status text not null CHECK (IN ('OPEN','RESOLVED','REFUNDED','CLOSED'))`, `resolution text CHECK (IN ('seller_settlement','buyer_refund','partial_refund'))`, `resolution_note text`, `resolved_by uuid → profiles`, `resolved_at timestamptz`, `created_at timestamptz`.

RLS: SELECT participants/staff; INSERT buyer-or-seller participant (with
CHECK on one-open-dispute via trigger); status UPDATE server-only.

### dispute_messages

`id uuid PK`, `dispute_id uuid not null → disputes cascade`, `author_id uuid not null → profiles`, `body text not null CHECK (char_length(body) > 0)`, `created_at timestamptz`.

RLS: SELECT participants/staff; INSERT author-participant or staff.

### dispute_evidence

`id uuid PK`, `dispute_id uuid not null → disputes cascade`, `uploader_id uuid not null → profiles`, `storage_path text`, `mime_type text`, `size_bytes bigint`, `created_at timestamptz`.

RLS: SELECT participants/staff; INSERT participant/staff. Files live in the
private `dispute-evidence` Storage bucket; signed URLs only.

---

## SETTLEMENT / REFUNDS (internal schema, server-only)

### internal.settlements

`id uuid PK`, `transaction_id uuid not null → transactions`, `recipient_id uuid not null → profiles`, `provider text not null`, `provider_ref text UNIQUE`, `amount_minor bigint not null CHECK (> 0)`, `status text not null CHECK (IN ('PENDING','PAID','FAILED'))`, `created_at/completed_at timestamptz`.

Extra guard: partial unique index `UNIQUE (transaction_id) WHERE status = 'PAID'` — a transaction can be paid out **once** (blocks double-settlement races at the DB level).

### internal.refunds

`id uuid PK`, `transaction_id uuid not null → transactions`, `payer_id uuid not null → profiles`, `provider text not null`, `provider_ref text UNIQUE`, `amount_minor bigint not null CHECK (> 0)`, `reason text`, `status text not null CHECK (IN ('PENDING','PAID','FAILED'))`, `created_at/completed_at timestamptz`.

Partial-refund cap: `CHECK (amount_minor <= (SELECT total_minor FROM public.transactions WHERE id = transaction_id))` — implemented as a trigger/function since it references another table.

---

## NOTIFICATIONS / OPS

### notifications (public)

`id uuid PK`, `profile_id uuid not null → profiles`, `type text not null`, `title text not null`, `body text`, `transaction_id uuid → transactions`, `read_at timestamptz`, `created_at timestamptz`.

RLS: SELECT/UPDATE own; INSERT server-only (notification creation is
server-side). Realtime: enable `postgres_changes` on this table for the
owner's rows.

### internal.audit_logs

`id uuid PK`, `entity_type text not null`, `entity_id uuid not null`, `actor_id uuid → profiles`, `action text not null`, `from_status text`, `to_status text`, `reason text`, `meta jsonb`, `at timestamptz not null default now()`.

**Server-only, append-only** (no UPDATE/DELETE grants at all). Read via staff-only SECURITY DEFINER function `internal.get_audit_log(...)`.

### internal.risk_flags

`id uuid PK`, `transaction_id uuid → transactions`, `profile_id uuid → profiles`, `flagged_by uuid → profiles`, `reason text not null`, `severity text not null CHECK (IN ('LOW','MEDIUM','HIGH'))`, `status text not null CHECK (IN ('OPEN','REVIEWED','CLEARED'))`, `created_at timestamptz`. Server-only.

### internal.admin_notes

`id uuid PK`, `transaction_id uuid → transactions`, `author_id uuid not null → profiles`, `body text not null`, `created_at timestamptz`. Staff-only writes; read via staff function.

---

## MIGRATION TABLES (internal)

- `internal.migration_identity_map (convex_user_id text PK, profile_id uuid not null)`
- `internal.migration_record_map (convex_table text, convex_id text, target_table text, target_id uuid, PK (convex_table, convex_id))`

Used by `scripts/migration/`; dropped after reconciliation.

---

## Convex functions → target equivalents

| Convex function | Target |
| --- | --- |
| `users.currentUser`, `profile.getOwnProfile` | `profiles` read + `get_my_roles()`; frontend `supabase.auth.getUser()` |
| `transactions.myTransactions` | SQL query on `transactions` by seller/buyer/participant + union; plain query |
| `transactions.detail` | RLS-guarded read + assembly in Edge Function or DB view |
| `transactions.create/publish/acceptTerms/cancel/markReady` | Edge Functions calling `internal.transition_transaction` + inserts |
| `transactions.freeze` | Edge Function (staff) → `risk_flags` + `dispute_blocked` + audit |
| `payments.requestPayment/confirmPayment` | Edge Functions; `confirmPayment` verifies via provider API / validated webhook — **not** a client-callable simulation |
| webhook ingestion | **new** Edge Function `webhooks/{provider}` (signature verify, idempotent insert, transactional effect) |
| `settlement.releaseTx` / `accept` | Edge Function `settle` calling `internal.release_tx(...)` (SECURITY DEFINER, idempotent, guarded by partial unique index) |
| `delivery.dispatch/confirmDelivery` | Edge Functions; OTP hashing + atomic verify function |
| `disputes.*` | Edge Functions + RLS-guarded reads |
| `admin.*` | Staff Edge Functions / RLS staff policies |
| `notifications.*` | RLS reads + Realtime; writes via `internal.notify(...)` |
| `jobs.inspectionAutoRelease` | Supabase scheduled function (pg_cron or Edge cron) running `internal.auto_release_due()` — server-authoritative, idempotent |
| `lib.audit` | `internal.append_audit(...)` SECURITY DEFINER |
| `lib.postDoubleEntry` | `internal.post_double_entry(...)` SECURITY DEFINER with balance trigger |
| `github.*` | dev tooling — keep as Convex action until retirement, or move to a small Node script |

## Transformation rules (reusable)

1. `*_id` Convex ids → `uuid` via `migration_record_map`/`migration_identity_map`. **Never insertion order.**
2. `*_kobo` → `*_miner`/`*_minor` bigint (same integer value).
3. `Date.now()` numbers → `timestamptz` (`to_timestamp(ms/1000)`).
4. `rawEvent`/`meta` JSON strings → `jsonb`.
5. Delivery OTP plaintext → HMAC hash at import (drop plaintext).
6. `users.role` (single) → `user_roles` rows: `admin`→`super_admin`+`operations_admin`, `ops`→`operations_admin`, `seller`→`seller`+`buyer`, `user`→`buyer`.
7. Media `url` strings without storage → import as-is into `transaction_media.storage_path` only when they point to migrated storage; otherwise keep as `url` external reference (migration report flags them).

## Migration risk register (top items)

| Risk | Mitigation |
| --- | --- |
| Identity mapping gaps (orphan actor ids) | Pre-load `migration_identity_map` from every actor column; reconcile counts (Phase 15) |
| Double settlement on release race | Partial unique index `settlements(transaction_id) where status='PAID'` + idempotent `release_tx` |
| Over-refund (partial > total) | DB trigger/check on `refunds.amount_minor` vs `transactions.total_minor` |
| Plaintext OTP leaked in migration | Hash at export/transform, never import raw codes |
| Ledger imbalance after import | Import ledger via same `post_double_entry` logic; balance query + tests (Phase 15) |
| Status history loss | Copy `transaction_status_history` 1:1; verify counts |
| RLS bypass via direct API | No grants on internal schema; staff-only functions; negative RLS test suite |
| Webhook replay | `UNIQUE (provider, provider_event_id)` + signature verify |