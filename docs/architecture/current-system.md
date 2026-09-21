# DealSure — Current System Architecture (Audit, 2026-09-03)

Status: baseline audit of the existing implementation **as found**, before the
Supabase migration. Everything here was verified against the repository
(`git rev-parse HEAD` = commit `62a6a81`).

> Brand: the product is now **No Ojoro** (formerly developed under the working
> names **DealSure** / **Deal Secure**); code identifiers and docs still use
> `DealSure` / `transactions` in historical and compatibility-sensitive places.
> All names refer to the same app.

---

## 1. Stack (as built)

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7 (PWA), Tailwind CSS v4, shadcn/ui primitives, Framer Motion, date-fns, Lucide |
| Routing | `react-router` v7 (`BrowserRouter`, lazy route components) |
| Backend / data | Convex (serverless functions + Postgres-backed document store), reactive `useQuery`/`useMutation` |
| Auth | Convex Auth — email OTP (`@convex-dev/auth` Email provider) + Anonymous provider + Freebuff custom-JWT federation (`auth.config.ts`) |
| Scheduling | Convex cron (`crons.ts`): `inspection auto-release` every 5 min |
| HTTP | Convex `httpRouter` — only auth routes today (`http.ts`) |
| Build tooling | `bun` (lockfile `bun.lock`), scripts: `dev`, `build` (`tsc -b && vite build`), `lint` (`eslint .`), `format`, `preview` |
| External services | Freebuff `send_otp` email endpoint; VLY integrations package; GitHub Octokit actions (dev tooling) |

**There is no dedicated test script and no test files in the repository**
(`**/*.{test,spec}.{ts,tsx,js,jsx}` → 0 matches; `package.json` has no `test`
script). This is a Phase-0 finding, not an assumption.

---

## 2. Frontend structure

```
src/
  main.tsx                      # router, Convex client, lazy pages, SW registration
  pages/                        # Landing, Auth, Home, Transactions, CreateTransaction,
                                #   TransactionDetail, Notifications, Profile, Admin,
                                #   AdminDispute, NotFound
  components/layout/AppShell.tsx# sidebar + mobile bottom nav, install banner, offline chip
  components/ui/                # ~40 shadcn/ui primitives
  components/RequireAuth.tsx    # auth gate
  hooks/use-auth.ts             # Convex Auth wrapper
  lib/                          # format, utils, vly-integrations
```

- All data access is **direct Convex hooks in page components**
  (`useQuery(api.transactions.myTransactions)` etc.). There is no data-access
  layer between UI and Convex; page components call `api.*` inline.
- PWA: `public/manifest.webmanifest` (standalone, `start_url: /home`,
  maskable SVG icon) + `public/sw.js` — static app-shell cache, network-first
  navigations, **never caches Convex RPC / cross-origin API traffic** (good).
- `src/main.tsx` posts iframe route changes to the parent frame (Freebuff
  toolbar integration) and listens for `navigate` messages.

---

## 3. Convex backend structure

```
src/convex/
  schema.ts            # defineSchema: auth tables + 28 domain tables
  config.ts            # business rules: currency, fees, limits, OTP, statuses, roles
  lib.ts               # requireUser/requireStaff/requireAdmin, audit(), notify(),
                       #   postDoubleEntry(), performTransition(), id gen helpers
  transactions.ts      # create/publish/acceptTerms/cancel/freeze/markReady/settle
  transactions/state.ts# ALLOWED_TRANSITIONS map + StateTransitionError + helpers
  payments.ts          # requestPayment / confirmPayment (+ provider webhook sim)
  payments/providers.ts# PaymentProvider interface + MockPaymentProvider
  settlement.ts        # releaseTx (release conditions), accept (buyer acceptance)
  delivery.ts          # dispatch (OTP gen), confirmDelivery (OTP verify)
  disputes.ts          # open/message/addEvidence/resolveDispute
  admin.ts             # searchUsers/listDisputes/disputeDetail/auditLog/listPayments/addAdminNote
  users.ts             # currentUser (read-only)
  profile.ts           # getOwnProfile/updateProfile/addBankAccount/submitKyc/setRole
  notifications.ts     # myNotifications/unreadCount/markRead/markAllRead
  jobs.ts              # inspectionAutoRelease cron (auto-accept + release)
  crons.ts             # cron registration
  http.ts              # httpRouter + auth routes
  github.ts            # Octokit actions (dev tooling; node runtime, GITHUB_TOKEN)
  auth.ts / auth.config.ts / auth/emailOtp.ts
```

## 4. Data model (Convex tables)

Auth tables from `authTables`: `_auth_users`, `_auth_sessions`,
`_auth_accounts`, `_auth_verification_codes` (managed by `@convex-dev/auth`).

Domain tables (all in `schema.ts`):

| Table | Purpose | Indexes |
| --- | --- | --- |
| `users` | identity: name, email, role, kycStatus, onboarded | `email` |
| `profiles` | full profile per user | `by_user`, `by_phone` |
| `kyc_profiles` | KYC status per user | `by_user` |
| `bank_accounts` | seller payout accounts | `by_user`, `by_accountNumber` |
| `terms_versions` | versioned terms text | `by_version` |
| `terms_acceptances` | user acceptances | `by_user`, `by_user_version` |
| `transactions` | the deal: status, seller, buyer, amounts (kobo), slug/publicId | `by_publicId`, `by_slug`, `by_seller`, `by_buyer`, `by_status`, `by_created` |
| `transaction_items` | line items | `by_transaction` |
| `transaction_media` | media refs (url or storageId) | `by_transaction` |
| `transaction_status_history` | append-only transition log | `by_transaction`, `by_transaction_desc` |
| `transaction_participants` | participant mapping (role buyer) | `by_transaction`, `by_user` |
| `payment_intents` | per-payment intent (PENDING/SECURED/…) | `by_transaction`, `by_providerEventId`, `by_idempotency`, `by_payer` |
| `payment_events` | raw provider events | `by_intent`, `by_providerEventId` |
| `ledger_accounts` | chart of accounts | `by_code` |
| `ledger_entries` | append-only double-entry rows | `by_account`, `by_transaction`, `by_ref` |
| `deliveries` | delivery/shipment record | `by_transaction`, `by_status` |
| `delivery_events` | delivery timeline | `by_delivery` |
| `delivery_otps` | one-time delivery codes (**stored plaintext** — see security review) | `by_transaction`, `by_delivery` |
| `disputes` | dispute record | `by_transaction`, `by_openedBy`, `by_status` |
| `dispute_messages` | conversation | `by_dispute` |
| `dispute_evidence` | evidence refs | `by_dispute` |
| `settlements` | payout records | `by_transaction`, `by_recipient` |
| `refunds` | refund records | `by_transaction`, `by_payer` |
| `notifications` | in-app notifications | `by_user`, `by_user_unread` |
| `audit_logs` | append-only audit trail | `by_entity`, `by_actor`, `by_action`, `by_at` |
| `risk_flags` | ops risk flags | `by_transaction`, `by_user` |
| `admin_notes` | ops notes | `by_transaction`, `by_author` |

## 5. Authorization model (as built)

- Roles: `user` | `seller` | `admin` | `ops` stored on the `users` row.
  `isStaff = role === admin || ops` (`config.ts`).
- Checks are **function-level** (Convex model — there is no row-level
  security; every query/mutation enforces ownership/participation/staff
  itself):
  - `requireUser` / `requireStaff` / `requireAdmin` in `lib.ts`;
  - `canViewTransaction` checks staff → seller → buyer → participant →
    pre-acceptance invite (authenticated holder of the unguessable slug).
- `profile.setRole` (admin only) is the only role-change path and is audited.

## 6. Money & state machine (as built)

- Money stored as **integer kobo** (`*_kobo`) — no floats (verified in
  `schema.ts`, `config.ts`).
- `transactions/state.ts` has an explicit `ALLOWED_TRANSITIONS` map; all
  transitions go through `lib.performTransition` which rejects invalid moves
  with `StateTransitionError` and writes `transaction_status_history` +
  `audit_logs`.
- `lib.postDoubleEntry` posts balanced debit/credit `ledger_entries`
  (imbalance throws). Ledger corrections must be reversals (documented
  invariant; there is no destructive-update path today).
- Payment success is only recognised inside `payments.confirmPayment`, which
  simulates the provider webhook server-side, validates captured amount
  against the intent, and is idempotent on `providerEventId` /
  `idempotencyKey`.
- Automated release is a **Convex cron** (`jobs.inspectionAutoRelease`), never
  a client timer.

## 7. Realtime usage

Convex reactive queries are used everywhere (every `useQuery` is live).
Genuinely realtime-feeling surfaces: transaction detail, notifications,
admin lists. The app currently has **no** websocket-specific product feature
beyond Convex's built-in reactivity.

## 8. Storage

- `transaction_media` / `dispute_evidence` store either a `url` string or an
  optional `storageId`. There is **no Convex file storage wiring** in the
  audited code — media is URL/text only today. Upload validation (MIME/size)
  is noted as TODO on the upload path.

## 9. Environment & secrets (as found)

- No `.env` / `.env.local` committed; **no `.env.example` exists**.
- `.gitignore` covers `*.local` but **not `.env`** — risk that a future
  `.env` gets committed.
- `src/convex/auth/emailOtp.ts` contains a **hardcoded Freebuff email API key**
  (`fb_email_…`) in source. Server-side only, but it is committed to Git →
  treat as leaked/rotate (CRITICAL, see security review).
- `src/convex/github.ts` reads `GITHUB_TOKEN` from `process.env` (server-side
  only — correct pattern).

## 10. Admin surface

- `/admin` (staff only in UI) shows deals, disputes, payments, audit log.
- Admin actions: `transactions.freeze`, `disputes.resolveDispute`
  (seller_settlement | buyer_refund | partial_refund),
  `admin.addAdminNote`, `profile.setRole`.
- Admin read paths all call `requireStaff`. There is no MFA on staff
  accounts today.

## 11. Known gaps (summary — details in the security & design reviews)

1. No test suite at all.
2. Hardcoded email API key in `auth/emailOtp.ts`.
3. Delivery OTP stored plaintext; generated with `Math.random` (not CSPRNG).
4. `partial_refund` has no upper-bound check (`refundKobo` ≤ total) —
   over-refund possible.
5. No `.env.example`; `.gitignore` misses `.env`.
6. Lint baseline fails: 90 errors / 20 warnings (mostly `no-explicit-any`,
   unused imports).
7. `npm audit` baseline: 8 vulnerabilities (2 critical, 1 high, 1 moderate,
   4 low) — undici (no fix available), `@convex-dev/auth` → `@auth/core`.
8. No rate limiting beyond Convex Auth's built-in OTP handling.
9. `transactions.list` (admin) materialises 300 rows in memory and filters in
   JS — won't scale on Postgres without real queries.
10. No realtime distinction: everything is reactive, everything refetches.

## 12. Verification evidence (Phase 0 baseline, run 2026-09-03)

| Check | Result |
| --- | --- |
| `tsc -b --noEmit` | PASS (exit 0) |
| `eslint .` | FAIL — 90 errors, 20 warnings |
| `npm run build` | PASS (`✓ built in 33.62s`) |
| `npm audit` | 8 vulns (2 critical, 1 high, 1 moderate, 4 low); undici has no fix |
| Tests | none exist |

> Note: `bun` was not installed on this machine; dependencies were installed
> with `npm install --no-package-lock` for verification only. The committed
> lockfile remains `bun.lock`.