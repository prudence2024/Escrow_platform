# Deal Secure — Protected Payments (PWA)

Deal Secure protects transactions in social commerce. A buyer pays through the
platform, money is held with a payment partner, the seller delivers, and the
seller is **only** paid after the buyer accepts the item (or the inspection
period passes without dispute).

> Working name "DealSure" was renamed to **Deal Secure** per product
> preference. The code identifiers still say `transactions`, and backend copy
> uses configurable wording — never hard-coded claims of being an escrow
> institution.

## Stack

- **Frontend** — React 19, TypeScript, Vite PWA, Tailwind v4, shadcn/ui, Framer Motion, date-fns, Lucide
- **Backend / data** — Convex (serverless functions + Postgres-backed store), reactive queries
- **Auth** — Convex Auth (email OTP + guest), see `src/convex/auth.ts`
- **Scheduling** — Convex cron for inspection auto-release (`src/convex/crons.ts`)

> The original brief specified Laravel/PHP + PostgreSQL. On this platform the
> authoritative transaction state machine, payment verification and settlement
> live in Convex `mutation`s (the domain boundaries are stack-agnostic). See
> `docs/architecture.md`.

## Setup

The project runs cloud-side with Convex already configured
(`VITE_CONVEX_URL` / `CONVEX_DEPLOYMENT` set in the environment).

```bash
npm install        # install deps (npm is the authoritative package manager;
                   # see "Package manager" below — package-lock.json is the lockfile)
npx convex dev --once   # push Convex functions + regenerate types
npm run dev        # start the Vite dev server
npx tsc -b --noEmit   # typecheck
```

To skip generated-type drift, run `npx convex dev --once` again after any
change under `src/convex/`.

## Package manager

**npm** is the authoritative package manager for the active DealSure
implementation (`packageManager: npm@10.9.3`, `package-lock.json`).
A legacy `bun.lock` was removed because Bun is unavailable in the validated
development environment and the stale Bun lockfile (missing test
dependencies) was less reproducible than an explicit npm decision.
Use `npm ci` for clean installs. Convex commands run via `npx`.

## Demoing the protected-transaction flow

You can run the whole happy path with one account (acting as both seller and
buyer) or two accounts.

1. **Create & publish** — create a protected deal, then publish to generate the
   secure share link (`/t/<slug>`).
2. **Buyer accepts** — open the link in another browser (or signed-out), sign
   in, and accept terms.
3. **Buyer pays** — tap "Pay securely". Payment is verified **server-side**
   through the mock payment provider (`src/convex/payments/providers.ts`) and
   the deal moves to `PAYMENT_SECURED`. Funds are only ever "held" with the
   partner abstraction — the app stores no customer funds.
4. **Seller dispatches** — add courier details; a one-time delivery code is
   generated.
5. **Buyer confirms delivery** — enter the delivery code; the inspection
   window starts.
6. **Buyer accepts** — funds are released to the seller (`SETTLED`).
   Alternately, opening a **dispute** blocks settlement and an ops/admin user
   resolves it (seller settlement or buyer refund) from `/admin`.

To test as admin: promote a user in the Convex dashboard (set `role` to
`admin` or `ops`) — or extend `profile.setRole` behind admin auth.

## Key invariants (enforced server-side)

- Money is stored as integer **kobo** (`*_kobo`), never floats.
- All status changes go through `lib.performTransition`, which validates against
  the explicit transition map in `src/convex/transactions/state.ts`.
- Payment success is only recognised inside `payments.confirmPayment`, which
  simulates the provider webhook, dedupes provider event ids, and is idempotent.
- Settlement is blocked while a dispute is open and only runs when release
  conditions are met (`src/convex/settlement.ts`).
- Automated release is a **cron**, never a client timer.
- Every state change writes an append-only audit + status-history entry.

## PWA

- Manifest: `public/manifest.webmanifest` (standalone, theme colours, maskable SVG icon)
- Service worker: `public/sw.js` (offline app shell, safe static caching only)
- Install prompt + offline indicator live in `src/components/layout/AppShell.tsx`
- Sensitive API traffic and all financial actions are never cached offline.

## Docs

- `docs/architecture.md`
- `docs/transaction-state-machine.md`
- `docs/security-decisions.md`