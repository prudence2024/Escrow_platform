# DealSure — Architecture

DealSure is a transaction-protection platform for informal/social commerce. A
buyer pays through the platform, the seller delivers, and settlement happens
only after release conditions are met.

## Stack

The product is built on the Freebuff Web template:

- **Frontend**: React 19 + TypeScript + Vite (PWA), Tailwind CSS v4, shadcn/ui
  primitives, Framer Motion, TanStack-free Convex reactive queries.
- **Backend / data**: Convex (serverless functions + Postgres-backed document
  store + reactive queries). Convex Auth powers sign-in (email OTP + guest).
- **Queue / scheduling**: Convex internal scheduler + a cron for inspection
  auto-release.

> The original brief called for Laravel/PHP + PostgreSQL. On this platform the
> authoritative state machine, payment verification and settlement live in
> Convex `mutation`s instead of a Laravel service layer. The domain boundaries,
> state machine and security invariants in this doc are stack-agnostic and are
> implemented verbatim in `src/convex/`.

## Key financial boundary

**DealSure does not hold customer funds.** Real fund custody / controlled
settlement requires an integration with a licensed bank or payment partner.
For this build we implement a **provider abstraction** (`PaymentProvider`)
with a sandbox `MockPaymentProvider`. Product copy is configurable ("payment
secured" / "protected payment" / "funds secured with payment partner") and we
never claim to be a licensed escrow institution.

## Domain modules

| Module | Location (Convex) | Responsibility |
| --- | --- | --- |
| Identity / roles | `schema.ts`, `users.ts` | users, profiles, permission-based roles |
| Transactions | `transactions.ts` | lifecycle, create/invite/accept, state machine |
| Payments | `payments.ts`, `payments/providers.ts` | provider abstraction, webhook-style verify, idempotency |
| Ledger | `lib.ts` ledger helpers + `payments`/`settlement` | double-entry, append-only entries |
| Delivery | `delivery.ts` | dispatch, events, OTP |
| Settlements | `settlement.ts` | release conditions, settlement |
| Disputes | `disputes.ts` | dispute flow + evidence + resolution |
| Admin / ops | `admin.ts` | search, freeze, dispute resolution |
| Notifications | `notifications.ts` | in-app notifications + abstraction stub |
| Audit | `audit_logs` table + `lib.audit()` | immutable trail |

## Tenets

- Monetary amounts are stored as **integer minor units** (`*_kobo`), never floats.
- All status changes are **server-authoritative** and validated against an
  explicit transition map. Browser state is never trusted for money.
- Payment success is only recognised inside a mutation that simulates a signed,
  idempotent provider webhook. Frontend redirects alone never settle a payment.
- Financial operations are idempotent via client `idempotencyKey` + server
  dedup on provider event ids.
- Every state change writes an `audit_logs` row (actor, ts, old, new, reason).
- Settlement is blocked while a dispute is open and only proceeds after release
  conditions are satisfied.
- Automated release (inspection auto-accept) is a **scheduled backend decision**
  (cron), never a frontend timer.