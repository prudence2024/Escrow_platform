# DealSure — Target System Architecture

The target keeps every working DealSure feature (create → accept → pay →
secure → deliver → inspect → accept/dispute → settle/refund) and replaces the
Convex document store with a relational Supabase/PostgreSQL architecture that
is auditable, constraint-enforced, and server-authoritative.

## Target stack

```
React 19 + TypeScript Vite PWA (unchanged UI)
        │
        ▼
supabase-js (auth session, RLS-guarded reads, Realtime)
        │
        ▼
Supabase Auth ─────────────── ONE identity system (email OTP + staff MFA)
        │
        ▼
Supabase PostgreSQL
   ├─ public schema    → RLS-guarded app tables (Data API)
   ├─ internal schema  → server-only financial/audit tables (NOT exposed)
   └─ private Storage  → evidence buckets, signed URLs only
        │
        ▼
Supabase Edge Functions (Deno) — trusted server layer:
   transaction lifecycle, payment verify/webhooks, settlement, refunds,
   delivery OTP, disputes, admin, auto-release scheduler
        │
        ▼
Payment Provider abstraction (mock today; licensed partner adapters)
```

**The browser can never write financial state.** All money-moving operations
execute in Edge Functions (or SECURITY DEFINER database functions) using the
service role server-side; the browser only reads RLS-guarded rows and calls
server endpoints.

## Layers

### 1. Frontend (mostly unchanged)

- Keep the existing pages, routing, PWA shell, and component library.
- Introduce feature-module data-access layers:
  `src/features/{transactions,delivery,disputes,payments,profile,admin}/api/`
  so pages stop calling Supabase/Convex inline. UI components present state;
  API modules own queries and mutations.
- Realtime: Supabase Realtime `postgres_changes` for transaction status,
  delivery, dispute messages, notifications; plain queries + refetch for
  history/profile/admin reports.
- Offline PWA shell unchanged; `sw.js` keeps never caching financial API
  responses. No offline financial mutations.

### 2. Authentication (see authentication-decision.md)

Supabase Auth for everyone: email OTP (passwordless), anonymous upgrade path,
staff MFA (TOTP), httpOnly session cookies via Supabase SSR helpers,
`profiles.id = auth.uid()` for Supabase Auth users.

### 3. Database (see database-boundaries.md + convex-to-postgres-map.md)

- `public`: profiles, user_roles, terms_*, transactions, transaction_items,
  transaction_media, transaction_status_history, transaction_participants,
  payment_intents (read-only for clients), deliveries, delivery_events,
  disputes, dispute_messages, dispute_evidence, notifications.
- `internal`: payment_events, provider_webhook_events, ledger_accounts,
  ledger_transactions, ledger_entries, settlements, refunds, delivery_otps,
  audit_logs, risk_flags, admin_notes, migration_*.
- RLS on every public table; grants restricted on internal; SECURITY
  DEFINER functions for all sensitive writes.
- Constraints at the DB level: CHECKs on money ≥ 0, state enum, transition
  validation, unique webhook event ids, unique idempotency keys,
  single-PAID-settlement, refund ≤ total.

### 4. Trusted server layer (Edge Functions / DB functions)

| Concern | Entry point |
| --- | --- |
| Create/publish/accept/cancel/freeze transaction | `transactions` Edge Functions |
| Request payment | `payments/request` |
| Verify payment (provider API) | `payments/verify` |
| Webhook ingestion (signed, idempotent) | `webhooks/{provider}` |
| Settlement / refund / dispute resolution | `settlement`, `disputes/resolve` |
| Delivery dispatch / OTP verify | `delivery/*` |
| Inspection auto-release | scheduled function (cron) |
| Role grants, KYC approval, audit reads | `admin/*` (staff, MFA) |

All financial effects are performed by SECURITY DEFINER functions in a single
transaction per operation (e.g. `internal.release_tx`) so RLS cannot be
bypassed and partial failure cannot corrupt state.

### 5. Payments

- Keep the `PaymentProvider` interface (`initializePayment`, `verifyPayment`,
  `handleWebhook`, `requestRefund`, `verifyRefund`, `requestSettlement`,
  `verifySettlement`, `reconcileTransaction`).
- Mock provider remains for dev; real adapters (Paystack/Flutterwave or a
  licensed partner) slot behind the same interface with credentials in Edge
  Function secrets.
- Webhook correctness: raw-body signature verification, unique event id
  dedup, replay protection, amount/currency/status validation, sanitized
  logging. **Never** call a provider balance "escrow" without the licensed
  legal/financial structure to support it.

### 6. Ledger

- `internal.ledger_accounts` + `internal.ledger_transactions` +
  `internal.ledger_entries`, append-only, balanced (debits == credits per
  ledger transaction, enforced by trigger + tests). Corrections via
  reversals only.

### 7. Storage

Private Supabase Storage buckets: `transaction-evidence`,
`delivery-evidence`, `dispute-evidence`, `kyc-documents`.
- Upload through Edge Function: auth + ownership check, size limit, MIME
  sniffing, extension allowlist, UUID rename, malware-scan hook.
- Downloads via short-lived signed URLs generated server-side only.
- Storage RLS: bucket-level policies per role/participant.

### 8. Realtime (deliberate, not mechanical)

- Realtime: transaction status, delivery updates, dispute messages,
  notifications.
- Not realtime: historical transactions, profile, config, analytics, admin
  reports → query invalidation/refetch.

### 9. PWA (preserved)

Manifest + service worker unchanged in behavior. Add: never cache
authenticated/API responses; offline shell only; no offline financial
mutations; safe-area + standalone behavior retained.

## Security invariants (target)

1. ONE identity system; DB-backed roles; staff requires MFA.
2. No client-controlled financial state; state transitions validated
   server-side (function + DB CHECK + transition table).
3. Signed, idempotent webhooks; provider-event dedup.
4. Append-only ledger & audit; reversals not edits.
5. Private evidence storage; signed URLs; size/MIME validation.
6. Least privilege: no direct grants on internal schema; narrow RLS
   policies; service role only in Edge Functions.
7. No secrets in frontend: `.env.example` with placeholders; keys in Edge
   Function secrets / server env only.
8. Rate limits on auth, webhooks, OTP verify, dispute/payment endpoints.
9. Every admin sensitive action audited (who/what/when/target/reason/result).

## Non-goals (unchanged from product brief)

Not a wallet, lending, investment, crypto, marketplace, or bill-pay app.
DealSure does not hold customer funds itself; funds are held with a payment
partner. Automated release is server-authoritative (scheduled function), never
a client timer.

## Cutover posture

Convex remains fully operational during migration (dual-run). Traffic moves
to Supabase only after: rehearsal migration, reconciliation report (financial
mismatch = failure), RLS negative tests, payment tests, E2E flows. Convex
stays in read-only/rollback form for a verification period, then is removed
(Phase 17).

## Open items to resolve with the owner

- Freebuff federated JWT → Supabase session bridge (Edge Function that
  validates the Freebuff JWKS token and provisions/links a Supabase user).
- Whether `profiles.id = auth.uid()` (recommended) or separate profile UUIDs
  keyed by `(auth_provider, auth_subject)` (needed if multiple identity
  providers must coexist in one table).
- Licensed payment partner + legal/financial wording of "funds secured".
- Email delivery for OTP in production (Freebuff endpoint today; the API key
  must move to a server secret — see security review).