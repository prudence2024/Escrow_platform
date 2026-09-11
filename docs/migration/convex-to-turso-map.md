# Convex → Turso Table Map (Phase 3)

Source: `src/convex/schema.ts` (27 app tables + Convex Auth internal tables).
Target: `server/db/migrations/001–010`. Convex stays authoritative at runtime;
this map is the design record for the future gradual migration (no data moves
in Phase 3).

Legend: DIRECT (same concept, mechanical renames) · TRANSFORM (shape change)
· SPLIT (one concept becomes two tables) · MERGE · DROP (not carried over)
· NEW (Turso-only normalization) · DEFER (decided later).

## Identity

| Convex | Turso | Class | Notes |
|---|---|---|---|
| `users` | `profiles` (+ `user_roles`) | TRANSFORM | Auth identity stays with the provider. Turso `profiles.id` is the provider-neutral user id; Convex `users.role` fans out to `user_roles` rows |
| `authAccounts`, `authSessions`, `authRefreshTokens`, `authRateLimits`, `authVerificationCodes` (`authTables`) | — | DROP | Provider-managed session secrets; Turso must never store them (§11) |
| `profiles` | `profiles` | TRANSFORM | `userId` FK becomes the PK; onboarded → 0/1; timestamps → INTEGER ms |
| `kyc_profiles` | `kyc_profiles` | DIRECT | + `document_reference` (external ref, never bodies) |
| `bank_accounts` | `bank_accounts` | DIRECT | + `provider_recipient_reference` for future tokenization |
| `terms_versions` | `terms_versions` | DIRECT | Immutable rows; version UNIQUE |
| `terms_acceptances` | `terms_acceptances` | TRANSFORM | References `terms_version_id` (was bare version int) + optional tx context |

## Transactions

| Convex | Turso | Class | Notes |
|---|---|---|---|
| `transactions` | `transactions` | TRANSFORM | `publicId`→`public_reference`, `slug`→`invite_slug` (both UNIQUE); new `transaction_origin` (default SHARE_LINK), `platform_fee_minor`, `inspection_deadline`, `expires_at`; money stays INTEGER minor |
| `transaction_participants` | `transaction_participants` | DIRECT | `userId`→`profile_id`; UNIQUE(tx, profile) kept |
| `transaction_items` | `transaction_items` | TRANSFORM | Adds `quantity > 0`, `unit_amount_minor` (Convex had name/note only) |
| `transaction_media` | `transaction_media` | TRANSFORM | `storage_key` metadata-first (url kept transitional) + MIME/size |
| `transaction_status_history` | `transaction_status_history` | DIRECT | `at`→`created_at` INTEGER ms |

## Payments

| Convex | Turso | Class | Notes |
|---|---|---|---|
| `payment_intents` | `payment_intents` | TRANSFORM | + `provider_reference` UNIQUE, `(transaction_id, idempotency_key)` UNIQUE |
| `payment_events` | `payment_events` + `provider_webhook_events` | SPLIT | Intent lifecycle events stay; provider inbox (signature/processing state) is its own table with `(provider, provider_event_id)` UNIQUE |
| — | `idempotency_keys` | NEW | Reusable `(scope, key)` UNIQUE store for financial retries |

## Delivery

| Convex | Turso | Class | Notes |
|---|---|---|---|
| `deliveries`, `delivery_events` | same names | DIRECT | Timestamps → INTEGER ms |
| `delivery_otps` | `delivery_otps` | TRANSFORM | `codeHash`→`code_digest` (HMAC hex, never plaintext) + `context`, `attempt_count`, `used_at` |

## Messaging (new domain)

| Convex | Turso | Class | Notes |
|---|---|---|---|
| — (only `dispute_messages` existed) | `transaction_threads` (UNIQUE tx), `transaction_messages` (USER/SYSTEM/… CHECK), `message_attachments`, `message_read_states` (composite PK) | NEW | Sender NULL = trusted SYSTEM; services (not schema alone) bar users from trusted types |

## Disputes

| Convex | Turso | Class | Notes |
|---|---|---|---|
| `disputes` | `disputes` | TRANSFORM | + `category`, `UNDER_REVIEW` status, partial unique index for one open dispute per tx |
| `dispute_messages` | `dispute_messages` | DIRECT | |
| `dispute_evidence` | `dispute_evidence` | TRANSFORM | URL → `storage_key` + MIME/size; bodies never in DB |

## Ledger (gap fill)

| Convex | Turso | Class | Notes |
|---|---|---|---|
| `ledger_accounts` | `ledger_accounts` | DIRECT | Same 1000/2000/4000 chart seeded in migration |
| — (missing) | `ledger_transactions` | NEW | Journal PARENT with `ref_id` UNIQUE + `reversal_of_id`; balance validated atomically by LedgerService (§24) |
| `ledger_entries` | `ledger_entries` | TRANSFORM | Points at journal parent; one-side-nonzero CHECK kept |

## Settlements / refunds

| Convex | Turso | Class | Notes |
|---|---|---|---|
| `settlements` | `settlements` | TRANSFORM | Partial unique index: one PAID per transaction |
| `refunds` | `refunds` | TRANSFORM | `requested_by`/`approved_by`, `currency`, `(transaction_id, idempotency_key)` UNIQUE; cumulative cap stays service-layer (documented) |

## Operations

| Convex | Turso | Class | Notes |
|---|---|---|---|
| `notifications` | `notifications` | DIRECT | Server-authored; read-state only for clients |
| `audit_logs` | `audit_logs` | TRANSFORM | + `request_id`; append-only by contract |
| `risk_flags` | `risk_flags` | TRANSFORM | Transparent `type/severity/source/status` (no scores) |
| `admin_notes` | `admin_notes` | DIRECT | Staff-only, separate from messages |

## Deferred

Merchant templates/branded links, milestone transactions, reputation aggregates,
provider live adapters, file-content scanning pipeline — V1/V2 scope, schema
room reserved (origins, metadata TEXT, storage keys) but tables not created.
