# No Ojoro — Architecture

> Canonical current brand: **No Ojoro**. Former working/product names:
> **DealSure**, **Deal Secure**. Legacy internal identifiers may continue to
> contain `dealsure` or `deal-sure` (database roles, provider ids, migration
> history, cache keys, seed data) for compatibility and historical reasons —
> they are not user-facing brand and must not be renamed without a compat plan.

No Ojoro is a transaction-protection platform for informal/social commerce. A
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

**No Ojoro does not hold customer funds.** Real fund custody / controlled
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

## Client platforms (No Ojoro)

No Ojoro is intended for:

- Web / PWA (current client: React 19 + Vite PWA in this repository)
- Android / Google Play (future native app)
- iOS / Apple App Store (future native app)

No native mobile app exists yet. No Expo configuration exists yet. No
Android package ID or iOS bundle ID has been chosen — store identifiers
must be deliberately reserved before any mobile release, conceptually:

- Android: `com.<organization>.nooj...` [NOT CHOSEN YET]
- iOS: matching controlled bundle identifier [NOT CHOSEN YET]

Existing technical application identifiers are NOT renamed merely because
the display brand changed.

All clients — web and future mobile — must call the trusted No Ojoro API:

- Mobile apps must NOT receive `TURSO_AUTH_TOKEN`, database credentials,
  payment-provider secrets, or server signing secrets.
- Future mobile authentication should use secure platform-backed storage
  (Keychain / Android Keystore-backed storage or equivalent).
- Consequential actions (payment confirmation, settlement, refunds, dispute
  resolution) remain server-authoritative; client state is never trusted
  for money.