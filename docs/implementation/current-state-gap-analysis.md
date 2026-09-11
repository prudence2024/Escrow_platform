# DealSure — Current-State Gap Analysis (Phase 0 + Phase 1)

Branch: `architecture/turso-startup` (audit workload only; no implementation).
Audit date: 2026-09-11. Method: direct code inspection (not prior summaries);
critical security claims re-verified firsthand. No code changed in this phase.

Guidance consulted: `prudence-codex-skills` `security` + `session-security`
(SKILL.md scope/workflow; applied as audit lens for auth, sessions, OTP,
rate limiting, headers). Repo docs consulted: `docs/architecture/`,
`docs/security/`, `docs/migration/`, `docs/requirements-traceability.md`
(R1–R48), `docs/transaction-state-machine.md`, `docs/security-decisions.md`.

**DOC STATUS (updated Phase 2):** the Master Blueprint v1 and Reference
Escrow Analysis are now persistent repository files (explicitly authorized):
`docs/dealsure/DealSure_Master_Product_and_Engineering_Blueprint_v1.md`
(byte-identical to the supplied attachment, SHA-256 verified at copy time)
and `docs/dealsure/21_Reference_Escrow_Platform_Codebase_Analysis.md`
(likewise verified). The latter remains ADVISORY ONLY.

Legend: IMPLEMENTED · PARTIALLY_IMPLEMENTED · NOT_IMPLEMENTED ·
IMPLEMENTED_BUT_INSECURE · NEEDS_DECISION · DEFERRED.

## 1. Platform / architecture

| Requirement | State | Implementation / files | Risk | Phase |
|---|---|---|---|---|
| React 19 + TS + Vite + Router + Tailwind + Radix | IMPLEMENTED | `package.json`, `src/main.tsx`, `vite.config.ts` | — | — |
| Node server API layer (Express/Hono) | NOT_IMPLEMENTED | Only Convex functions (`src/convex/`); `main.ts` is a Deno static server | Blocks Turso target arch | 2–4 |
| Turso/libSQL integration | NOT_IMPLEMENTED | Zero `@libsql` refs, no `TURSO_*` env, no SQLite migrations; only `supabase/migrations/` exists | Core roadmap item | 3 |
| Repository/service abstraction | NOT_IMPLEMENTED | Inline `ctx.db.*` (82 hits, e.g. `transactions.ts`, `delivery.ts`, `admin.ts`); UI calls `api.*` directly; only seam is `PaymentProvider` (`payments/providers.ts:46`) | Coupling; must precede persistence swap | 4 |
| Zod boundary validation (server) | PARTIALLY_IMPLEMENTED | zod used once (frontend `CreateTransaction.tsx`); backend relies on Convex `v.*` arg validators (good, but provider-specific) | Replace w/ zod at API layer in Phase 4 | 4 |
| PWA installable shell | PARTIALLY_IMPLEMENTED | `public/manifest.webmanifest`, `public/sw.js` (prod-only, never caches Convex/auth); missing 192/512 PNG icons, apple-touch, theme-color; no `vite-plugin-pwa` | Store/install gaps | 17 |
| Offline financial safety | PARTIALLY_IMPLEMENTED | SW avoids sensitive caching by path; no `no-store` headers verified | Low (short sessions) | 17 |
| Tests (all layers) | NOT_IMPLEMENTED | Zero `*.test.*`, no runner, no `test` script; only Supabase RLS SQL suite (different branch) | No regression net | 18 + per-phase |

## 2. Identity, auth, sessions

| Requirement | State | Implementation / files | Risk | Phase |
|---|---|---|---|---|
| Email OTP signup/signin | IMPLEMENTED | Convex Auth email-otp (`auth/emailOtp.ts`: CSPRNG 6-digit, 15-min TTL, generic errors, fail-closed send) | — | — |
| Session issuance/validation | IMPLEMENTED | Convex Auth JWT + `getAuthUserId` wrappers; `requireUser/Staff/Admin` (`lib.ts:15-31`) used by all domain functions | Expiry/rotation internals UNKNOWN (library) | 2 (define) |
| Guest mode | IMPLEMENTED_BUT_INSECURE | `Anonymous` provider (`auth.ts:9`); guests pass `requireUser` with FULL user powers, share prod tables, no expiry/upgrade enforcement | Abuse, tainted data | 2 |
| AuthService abstraction | NOT_IMPLEMENTED | Direct `@convex-dev/auth` use + `lib.ts` helpers | Provider lock-in | 2 |
| Freebuff federated JWT | PARTIALLY_IMPLEMENTED | RS256+JWKS (`auth.config.ts:25-31`) but expands trust boundary; retirement undecided (`freebuff-jwt-retirement.md`, `authentication-decision.md:55`) | Foreign tokens = local users | 2 (decision) |
| Staff MFA / re-auth for sensitive ops | NOT_IMPLEMENTED | None (`requirements-traceability.md` R36 ❌) | Admin takeover impact | 2/15 |
| Rate limiting (login/OTP/invite/payment/webhook) | NOT_IMPLEMENTED | Zero hits in `src/`; only non-atomic delivery attempt counter | Credential/OTP stuffing, invite enumeration | 2 |
| Security headers/CSP/CORS/CSRF posture | NOT_IMPLEMENTED | No headers in `vite.config.ts`/`main.ts`; wildcard `postMessage` (`main.tsx:38-59`) | Clickjacking/XSS blast radius | 2 |
| Session timeout/warning/rotation UX | NOT_IMPLEMENTED | No idle/absolute timeout, no warning, no cross-tab coordination (per session-security lens) | Stale sessions on shared devices | 2 |

## 3. Money & financial integrity

| Requirement | State | Implementation / files | Risk | Phase |
|---|---|---|---|---|
| Integer minor units, no float money | IMPLEMENTED | `*_kobo` everywhere (`schema.ts`, `config.ts:121-124`, `format.ts`); no `parseFloat`/`toFixed` in `src/` | — | — |
| Central state machine, no client status writes | IMPLEMENTED | `ALLOWED_TRANSITIONS` + `performTransition` (`lib.ts:170-208`); no mutation takes `status`; 16 canonical states | — | — |
| Sandbox/mock payments only | IMPLEMENTED | `MockPaymentProvider` sole impl (`providers.ts:78-116`); `PaymentProvider` seam exists | — | — |
| Backend-verified payment | PARTIALLY_IMPLEMENTED | `confirmPayment` (`payments.ts:86-163`) is buyer-callable and *simulates* the webhook in-transaction; guards (buyer-only, PROCESSING-only, amount equality, idempotent replay) are real but provider proof is self-asserted | Becomes P0 the moment a real provider is wired | 11 |
| Signed webhooks/idempotency/replay | PARTIALLY_IMPLEMENTED | Event-id dedup + idempotency keys on mock path; no signature, no HTTP webhook route (`http.ts` auth-only) | Required before live PSP | 11 |
| Double-entry ledger, balanced, append-only | PARTIALLY_IMPLEMENTED | `postDoubleEntry` per-posting balance check (`lib.ts:142-144`); no `ledger_transactions` parent table in Convex (entries only), no balance queries, `reversalOfEntryId` never written | Weak audit trail for scale | 12 |
| Refund caps (≤ remaining, no double refund) | IMPLEMENTED_BUT_INSECURE | `resolveDispute` checks only `>0` (`disputes.ts:145-146`); no per-tx refund lookup, no cap vs `totalKobo` | Over-refund by staff misuse/bug | 13 |
| Settlement guards (state, dispute, idempotency, no double-pay) | PARTIALLY_IMPLEMENTED | `releaseTx` (`settlement.ts:22-98`): state/freeze/dispute/SECURED checks real; but no existing-settlement lookup before insert (`:68`), `idempotencyKey` accepted never used | Concurrent double settlement | 13 |
| Dispute freezes settlement | IMPLEMENTED | `DISPUTED` status + `disputeBlocked` + OPEN-dispute check in `releaseTx:35-40` | — | — |
| Delivery OTP (CSPRNG, hashed, expiry, single-use, capped) | IMPLEMENTED_BUT_INSECURE | `Math.random` (`lib.ts:56`), plaintext `codeHash` (`delivery.ts:42` + TODO), 3h TTL, non-atomic attempt bump, unlimited re-issue via `dispatch`, code returned to seller (`delivery.ts:69`) | OTP prediction/leak; MUST fix before any real-money flow | 8 |

## 4. Communication, evidence, notifications, admin

| Requirement | State | Implementation / files | Risk | Phase |
|---|---|---|---|---|
| Transaction messaging (threads, read states, SYSTEM vs USER) | PARTIALLY_IMPLEMENTED | Dispute-only messages (`dispute_messages`); no tx threads, no read receipts, no SYSTEM/USER separation | Core workspace gap | 7 |
| Evidence upload (private storage, validation, scan) | NOT_IMPLEMENTED | URL-only `addEvidence` (`disputes.ts:92-107`, TODO scan); no storage, no MIME/size checks; buyer/seller have no evidence UI | Untrusted URLs, no chain of custody | 9 |
| Notifications | PARTIALLY_IMPLEMENTED | In-app table + `notify()` + badge UI; email/SMS/push stubbed | Engagement only | 10 |
| Dispute workspace (timeline, payment/delivery state, notes, audit) | PARTIALLY_IMPLEMENTED | Backend + `/admin/disputes/:id` exist; buyer/seller view is messages list only; no unified timeline | Ops efficiency | 9/15 |
| Admin mission control (all domains) | PARTIALLY_IMPLEMENTED | Deals/disputes/payments/audit + notes/freeze/setRole; server-gated (`requireStaff/Admin`); no MFA; in-memory 200–500 row pulls; no KYC/risk/provider-health views | Scale + least-privilege gaps | 15 |
| Least-privilege admin tiers | PARTIALLY_IMPLEMENTED | `admin` vs `ops` in `isStaff`; no support/dispute/finance split in Convex (finer than Supabase target) | Over-privileged ops | 15 |
| Audit logging (append-only, no secrets) | IMPLEMENTED | `audit()` on every mutation (`lib.ts:65+`); review shows no secret payloads | — | — |
| Risk/trust signals | PARTIALLY_IMPLEMENTED | `risk_flags` table + `freeze` writes; no signals/scoring (correctly deferred) | — | 14 |
| Terms versioning UI / KYC upload+approval | PARTIALLY_IMPLEMENTED | Tables + submit exist (`profile.ts`); v1 hard-coded, no approval flow/UI | Legal enforceability | 5/15 |

## 5. Prioritized findings

### P0 — fix before any real-money flow (none exploitable at scale today, all dev-stage)
- **P0-1 Delivery OTP plaintext + `Math.random`** (`lib.ts:52-59`, `delivery.ts:37-45`): predictable, readable codes. Fix in Phase 8 (CSPRNG + HMAC-SHA256 + atomic verify + single live code).
- **P0-2 Unbounded partial refunds** (`disputes.ts:145-151`): cap `≤ totalKobo − prior refunds`, per-tx check, in Phase 13.
- **P0-3 Settlement double-insert race** (`settlement.ts:60-77`): enforce single-PAID-per-tx (unique guard + use idempotencyKey) in Phase 13.
- **P0-4 `confirmPayment` buyer-triggered self-assertion** (`payments.ts:86-123`): acceptable for mock; MUST become provider-signed-webhook-only in Phase 11. Never carry this pattern to a live PSP.

### P1 — foundation before core workflows
- Auth/session hardening: rate limits, security headers, session timeout policy, staff MFA, Freebuff JWT decision, guest privilege separation, `AuthService` abstraction (Phase 2).
- Repository/service interfaces + zod at boundaries before persistence work (Phase 4).
- Turso schema/migrations + FK enforcement + idempotency keys (Phase 3).
- Evidence storage path + validation (Phase 9); tx messaging + SYSTEM separation (Phase 7).
- Commission/locate the 00–20 product suite (or formally adopt R1–R48 + decisions as source of truth) before Phase 6.

### P2 — important MVP functionality
- Terms UI + KYC approval flow; unified dispute timeline; admin tiers/views; notifications beyond in-app; expiry scheduler (EXPIRED has no cron); `listProviders` auth cosmetic; error-message enumeration hardening; `postMessage` origin check.

### P3 — polish/scale/future
- PWA icons/metadata/plugin; trust-signal expansion; balance-query APIs; reversal-entry convention; search pagination; provider-health dashboard; backup/restore (Convex-managed currently — document on Turso).

## 6. Conflicts / open decisions (NEEDS_DECISION)
1. Product source of truth: missing 00–20 suite vs R1–R48 + ad-hoc decisions — adopt formally or commission.
2. Freebuff federated JWT: keep or retire (`authentication-decision.md:55`).
3. Delivery OTP TTL: code says 3h (`config.ts:37-41`), `security-decisions.md:24` says 3-minute — code authoritative; decide intended value in Phase 8.
4. Anonymous guests: full powers today vs "low-privilege" intent (`security-decisions.md:6-10`) — decide model in Phase 2.
5. Dual-run Convex during Turso build (R46 ⬜): decide before Phase 3 writes.

## 8. Phase 1B appendix — Blueprint reconciliation (2026-09-11)

Authoritative source now: Master Blueprint Docs 01–20 (plus Decision
Register ADR-001–ADR-020 and gate-based Roadmap). Advisory only: Reference
Escrow Analysis (Doc 21). No prior valid finding was deleted; wording
differences were kept and mapped. No code or schema changed in this pass.

### 8.1 Status-change log (prior finding → reconciled state)

| Prior finding | Change | Reason |
|---|---|---|
| Missing 00–20 suite (NEEDS_DECISION) | RESOLVED (limitation lifted) | Master Blueprint v1 supplied and read completely (Docs 01–20 + bibliography) |
| Staff MFA (P1) | → **P0** (gated: "before privileged launch") | Blueprint Feature Catalog marks Staff MFA P0; Security Arch §11.12 + release gate §11.17 require MFA before real-money privileged access |
| Rate limiting (P1) | UNCHANGED (P1) | Blueprint confirms as NFR + release-gate item, but it gates pilot readiness, not Phase 2 entry |
| Partial refunds in P2-list | Corrected: partial refunds are **P1** per Feature Catalog (with cap + race protection) | Wording fix; implementation phase stays 13 |
| Ledger "no parent table" note | Strengthened: Blueprint DB Arch §10.7 **requires** `ledger_transactions` parent + per-tx balance invariant | Convex has entries-only; Turso schema must add parent table |
| Messaging PARTIAL | Confirmed + extended: Blueprint requires threads, read states, presigned attachments, SYSTEM authority | Phases 7/9 |
| Evidence NOT_IMPLEMENTED | Confirmed + extended: private buckets, random keys, MIME+extension+size, malware scan, signed URLs, metadata stripping (§11.9) | Phase 9 |
| PWA PARTIAL | Confirmed; Blueprint adds update-handling + reconnect + no-offline-mutations (§17.10) | Phase 17 |
| Tests NOT_IMPLEMENTED | Confirmed + extended: Blueprint Testing Manual adds migration tests, performance baselines, mobile/PWA tests, definition-of-done | Harness in Phase 2, cases per phase |
| Turso "no migrations" | Extended: Blueprint requires FK-on, immutable history, explicit prod migration step (ADR-019), seed guards, export/reconciliation tooling (§10.15) | Phase 3 |

### 8.2 P0 reconciliation (Blueprint strengthens, none cleared, none block Phase 2)

1. **P0-1 Delivery OTP (Math.random + plaintext).** Exact risk: predictable
   codes + DB-readable secrets → delivery fraud. Blueprint §11.8 ADDS:
   HMAC with server secret, timing-safe compare, rate limit, and **separate
   secrets/domains for auth OTP vs delivery OTP**; ADR-011: OTP is supporting
   evidence, never sole release condition. Blocks Phase 2? **No**
   (no money path in Phase 2). Correct phase: **8**.
2. **P0-2 Unbounded partial refunds.** Exact risk: staff bug/misuse refunds
   more than secured. Blueprint §6.7 makes it a formal invariant
   (pending+successful ≤ refundable) + concurrency tests (§10.14, §17.5).
   Blocks Phase 2? **No.** Correct phase: **13**.
3. **P0-3 Settlement double-insert race.** Exact risk: concurrent calls in
   RELEASE_PENDING double-pay. Blueprint §6.7 (no double settlement) +
   §12.11 (`Idempotency-Key` infra with stored key/actor/hash/result) + unique
   guards. Blocks Phase 2? **No.** Correct phase: **13**.
4. **P0-4 Buyer-triggered mock confirmation.** Exact risk: pattern carried to
   a live PSP = fake payment proof. Blueprint §6.5/§11.6 (redirects are UX
   only; signed webhook + server verification authoritative) + §12.12
   normalized provider events (PAYMENT_SUCCEEDED/...) + release gate §11.17.
   Blocks Phase 2? **No**, but Phase 2 must not entrench the pattern.
   Correct phase: **11**.
5. **P0-5 (NEW) Staff MFA before privileged launch.** No MFA/re-auth exists;
   Blueprint catalog P0 + §11.12 + release gate. Scoped to privileged-access
   launch gate; design lands in Phase 2, enforcement before any live money.

### 8.3 Newly discovered requirements (missed for lack of docs)

| # | Requirement (Blueprint ref) | State | Recommended phase |
|---|---|---|---|
| N1 | Brand clearance workstream: CAC, trademark, domain/handles (suite note, ADR-002) | NOT_IMPLEMENTED (business) | Pre-launch workstream, start early (P1 process) |
| N2 | Nigerian counsel + licensed partner contract before live money; "partner first, not custodian" (company rule, Doc 01, ADR-010/014) | DEFERRED (by design) | Engage early (P1); gate for live pilot |
| N3 | NDPA 2023 privacy: minimization, retention schedule, deletion/anonymization, data-subject workflow, evidence access logging (§11.14, PRD §6) | NOT_IMPLEMENTED | 2 (policy) → enforce per phase |
| N4 | `merchant / support / dispute_agent / finance` roles (DB §10.3, API §12.10); Convex has only user/seller/admin/ops | NOT_IMPLEMENTED | 2 (model) → 4/15 (enforce) |
| N5 | Normalized webhook event contract + `Idempotency-Key` infrastructure (§12.11–12) | NOT_IMPLEMENTED | 4 (infra) → 11 (use) |
| N6 | Standard error envelope `{code,message,requestId}`, no stack traces; pagination/max limits; request size limits (§12.2, §11.11) | NOT_IMPLEMENTED | 4 |
| N7 | Transaction snapshots / immutable agreed facts independent of mutable listings (DB §10.5 quantities/fees; ref §3.4) | PARTIALLY_IMPLEMENTED (amounts server-computed, no snapshot discipline; verify item quantity in Phase 5) | 5/6 |
| N8 | Evidence presign flow + private storage + scan + signed URLs (§12.8–9, §11.9) | NOT_IMPLEMENTED | 9 |
| N9 | Draft-edit endpoint (eligible DRAFT fields only, §12.4) | NOT_IMPLEMENTED | 6 |
| N10 | Invite preview = minimum safe fields; invite URL never authorizes financial actions (§7.6) | PARTIALLY_IMPLEMENTED (slug-gated view exists; codify field list) | 5 |
| N11 | Structured JSON logging + redaction; correlation IDs (§13.6, §9.11) | NOT_IMPLEMENTED | 4 (scaffold) → 19 |
| N12 | Job processing for webhooks/notifications/expiry/payouts; never frontend timers as authority (§9.10) | PARTIALLY_IMPLEMENTED (Convex cron exists; jobs layer needed for Node) | 4/8 |
| N13 | Staging env + prod fail-closed config; migration as explicit deploy step (ADR-019, Doc 14) | NOT_IMPLEMENTED | 3 |
| N14 | Backups/PITR + restore drills + RPO/RTO (Doc 14, §11.17 gate) | NOT_IMPLEMENTED | 3 (Turso PITR) → 19 |
| N15 | Monitoring/alert catalog (§11.15, Doc 14/18) + incident runbooks (Doc 18) | NOT_IMPLEMENTED | 15/19 |
| N16 | Milestones / split payments / multi-party / multi-currency (P1–P2, partner/legal-dependent) | DEFERRED | V2+ (do not MVP) |
| N17 | Merchant templates/branded links/API keys/merchant webhooks (P1–P2) | DEFERRED | V1–V2 |
| N18 | Fee/pricing measurement before finalizing (Doc 05 §10) | NEEDS_DECISION (business) | Before live pilot |
| N19 | Support doctrine: never promise refund pre-decision (Doc 18 §9) | NOT_IMPLEMENTED (ops doc) | 15 |
| N20 | AI two-pass rule + human-review gates for prod migration/live payments/role changes (Doc 15) | ADOPTED (process; this run follows it) | Ongoing |

### 8.4 Reference-platform lessons (Doc 21 — advisory)

ADOPT (DealSure-native, mapped to roadmap): server-side provider verification
with ref/amount/currency/state checks (11); webhook signature + idempotency
(11); atomic financial ops + race tests (12/13); transaction snapshots (5/6);
provider adapter pattern — already exists, extend (11); extensive domain-test
categories as test inspiration (18 + per phase); optional listing/marketplace
origin feeding one engine (V2, §8.6).
ADOPT WITH STRONGER CONTROLS: disputes workspace, refunds/payouts
invariants, admin workflows, append-only audit enforcement, auth/session
design, seller public profiles (privacy-minimized).
REJECTED outright: Django copy/merge; localStorage JWT session model;
seller-triggered provider payout; coarse `is_staff`-only authz; unenforced
"immutable" labels; hardcoded secrets/DEBUG posture; weaker state machine;
wholesale code copying; broad provider-payload retention. (Reference security
findings stay in the reference project; nothing imported — no secret transfer.)

### 8.5 Multiple transaction origins (future-proofing, no build now)

Adopt the principle: many origins → one DealSure transaction engine.
Plan a lightweight `transaction_origin` TEXT concept in the Turso schema
(Phase 3): `SHARE_LINK` at inception; reserve `MARKETPLACE`,
`MERCHANT_CHECKOUT`, `API`, `ADMIN_ASSISTED`, `PARTNER` without behavior.
Default `SHARE_LINK`; index for future reporting. This avoids schema lock-in
while keeping MVP scope unchanged. Marketplace itself stays V2.

### 8.6 Turso migration sequence (incremental; no big-bang Convex deletion)

1. **Phase 2** — auth/session decisions + `AuthService` + authz test harness
   (revised scope §8.7). Convex keeps running everything.
2. **Phase 3** — Turso dev database + immutable migrations per DB Arch §10
   (FK on, indexes §10.13, `transaction_origin`, webhook-event + thread/
   read-state tables, `ledger_transactions` parent, idempotency store) +
   migration tests (clean-DB, FK, seed-guard, upgrade) + export/reconcile
   tooling (§10.15). No traffic moved.
3. **Phase 4** — Node/Express skeleton per §9.4: config fail-closed, zod,
   error envelope, request IDs, structured logs, repo interfaces (reads
   first), services behind interfaces; shadow/dual-read paths where safe.
4. **Phase 5** — transaction reads via API (list/detail/invite-preview with
   minimum-safe-fields); Convex still authoritative for writes.
5. **Phase 6+** — writes slice by slice (draft-edit → accept → payment →
   delivery → messaging → disputes → ledger → refunds/settlements), each with
   reconciliation vs Convex; cutover only on R46/R47 criteria. Staging +
   explicit migration step before any shared-env switch.

### 8.7 Revised Phase 2 scope — AUTHENTICATION + SESSION SECURITY (exact, not started)

1. **Decisions (recorded):** Freebuff JWT retire-or-pin; Node auth library
   per ADR-020 (Convex Auth stays the active provider until the API needs
   its own); session transport for Turso API — httpOnly cookies vs bearer
   tokens with mobile-compat analysis; CSRF stance follows transport
   decision; OTP TTL confirmation (3h vs 3-min conflict).
2. **`AuthService` abstraction** (server): `getUser/session/roles`,
   `require*` guards incl. new `merchant/support/dispute_agent/finance`
   roles (N4), sign-out, revocation verification; Convex adapter first.
3. **Guest model:** sandbox/read-only guests; block create/pay/accept/
   deliver/dispute/settle/admin; explicit upgrade + expiry.
4. **Rate limits** (server, windowed): login, OTP send/verify, invite lookup,
   tx create, payment init, dispute create; generic errors (no enumeration).
5. **Session policy:** idle + absolute expiry, 60s warning + extend,
   cross-tab logout, revocation semantics verified against provider;
   transport flags (HttpOnly/Secure/SameSite) documented.
6. **Staff hardening design:** MFA path + step-up re-auth for
   resolve/refund/setRole; reason-required + confirmation for overrides
   (enforcement lands with admin slices; gate before live money).
7. **Edge posture:** security headers/CSP, tight CORS, `postMessage` origin
   pin, request size limits.
8. **Test harness + first authz matrix** (unrelated-user, buyer↔seller
   impersonation, forged role/ID, expired/revoked session) — grows per phase.
9. Gates: typecheck + lint + build + security review (playbook §16.3–4);
   STOP for approval before Phase 3.

### 8.8 Conflicts requiring a decision (carried + new)

Carried: OTP TTL; guest powers; Freebuff JWT; product source-of-truth
(resolved: Blueprint adopted); pricing (N18). New: Node auth library choice;
session transport (cookie vs bearer); role-model introduction point;
Supabase frozen branch stays reference-only (confirmed — ADR-013, no
conflict); reference localStorage-JWT rejected (no conflict); live-money
legal/partner engagement timing (recommend: begin counsel conversation
during Phase 2–4, contract before live pilot).

## 7. Original Phase 2 sketch (SUPERSEDED by §8.7 — kept for audit trail)
1. Decide Freebuff JWT (retire or pin audience + document); record in decision doc.
2. Introduce `AuthService` abstraction (server): `getAuthenticatedUser/requireRole/signOut/revoke` behind an interface; Convex Auth as first adapter; no provider logic in services.
3. Guest model: read-only/demo-sandbox guests (no create/pay/accept/dispute/settle/admin); explicit upgrade path; expiry.
4. Rate limiting (server): login, OTP send/verify, invite lookup, tx create, payment init, dispute create — windowed counters + generic errors (no enumeration).
5. Session policy: idle + absolute timeouts, 60s warning with extend, cross-tab logout, revocation list behavior verified against provider; document transport (cookie flags).
6. Staff: MFA requirement + step-up re-auth for `resolveDispute`/`setRole`/refunds; distinct support/dispute/ops/finance gates (start server-side).
7. Headers/CORS/CSRF: security headers + tight CORS + `postMessage` origin pin.
8. Tests: authz matrix tests (A-cannot-read/modify-B, forged role/ID rejected, expired/revoked denied) — harness first, cases grow per phase.
9. Security review + typecheck + lint + build; STOP for approval before Phase 3.

## 9. Phase 2 outcome (auth foundation � implemented, see Phase 2 report)

- AuthService abstraction exists (`src/lib/auth/*`, `src/convex/authService.ts`, `authz.ts`); `useAuth().principal` is the UI seam.
- Freebuff federated JWT RETIRED from auth trust (code + env + docs).
- Guests sandbox-enforced server-side across all consequential mutations.
- Canonical 8-role vocabulary + capability map + tx-context guards live; forged roles resolve to zero.
- Delivery OTP P0 FIXED (CSPRNG + HMAC digest + 10-min TTL + single-live-code + dev-gated reveal); legacy rows fail closed.
- Rate limits enforced where a stable server key exists; OTP-send/invite-lookup/IP honestly deferred.
- Step-up registry + `requireStepUp` wired to role.change + refund.approve; production denies without MFA (BLOCKED pending MFA-capable authenticator � not faked).
- Headers at the real static layer; postMessage origin-pinned; CSP documented as deployment work.
- vitest harness: 33 tests passing. P0-2/P0-3/P0-4 untouched per scope (Phases 11/13).

## 10. Phase 3 outcome (Turso database foundation — parallel scaffolding, zero cutover)

GENUINELY IMPLEMENTED in Phase 3 (all validated below; Convex app untouched):

- `@libsql/client` + `tsx` added via npm; `npm run migrate` / `npm run seed:dev` scripts.
- `server/config/env.ts`: explicit modes (cloud/file/memory), production fail-closed (tested).
- `server/db/client.ts`: server-only factory (browser import throws), FK pragma on every connection (verified).
- `server/db/migrate.ts` + `migrate-cli.ts`: ordered files, `_schema_migrations` with SHA-256, atomic apply via interactive transactions, no rerun, checksum drift = loud failure.
- `server/db/migrations/001–010`: 35 tables, STRICT (verified: INTEGER rejects TEXT/REAL; documented TEXT-direction limit), FKs everywhere, closed CHECK lists, UNIQUE + partial-unique guards (one OPEN dispute, one PAID settlement per tx), full index strategy, ledger chart seeded.
- `server/domain/ids.ts` (UUID/public-ref/96-bit slug) + `server/domain/money.ts` (minor-unit guards, MAX_SAFE_INTEGER, ₦50–₦10M bounds).
- 12 repository interfaces (`server/repositories/interfaces/`); implementations deferred to service phases.
- `server/db/seed/dev.ts`: synthetic 11-state seed, refuses production (tested), git-ignored dev DB default.
- `server/migration/convexExport.ts`: explicit-artifact dry-run inspector only (no auto-connect, no writes).
- Docs: `convex-to-turso-map.md` (27 Convex tables classified), `convex-to-turso-reconciliation.md` (cutover gates), `turso-development-architecture.md` (decisions incl. STRICT limits, INTEGER-ms time, ledger honesty). Cloud-Turso connectivity unverified (no credentials) — local libSQL only.

EXPLICITLY NOT IMPLEMENTED (do not mark complete): Node API, repository implementations, services, frontend cutover, real payments/settlements/KYC, provider execution, production data, Convex traffic migration.

## 11. Phase 3A hardening (frozen with baseline migrations 001–011)

- Invite slugs raised 96→128-bit CSPRNG (`newInviteSlug` enforces 32 hex).
- `payment_events` dedup scoped to `(payment_intent_id, provider_event_id)`; webhook inbox stays `(provider, provider_event_id)`; retries use fresh idempotency keys (transaction_id deliberately not unique on intents).
- Migration 011 adds BEFORE UPDATE/DELETE ABORT triggers on ledger/audit/payment-events/status-history/delivery-events; webhook inbox, OTP rows, notifications, and status workflows stay stateful by design. Mutation tests prove both directions.
- One-OPEN-dispute race tested (partial unique index is the backstop).
- Identifier/capability/identity distinction, message-trust rule, money ceiling rationale, freeze rule (001–011 immutable; future work uses 012+), and cloud smoke-test gate documented in `turso-development-architecture.md`.
- Cloud Turso remains UNVERIFIED (no credentials) — not a blocker for the local-architecture freeze.

## 12. Phase 4 outcome (read-only API foundation; Convex authoritative for writes)

- Hono selected over Express (in-core middleware, `app.request()` testability, +1 adapter dep only); decision recorded with auth-bridge findings.
- `/api/v1`: health, readiness, transaction list/detail, safe invite preview, own profile, public seller card. OpenAPI: `docs/api/v1-openapi.yaml`.
- Auth: `ApiAuth` + deny-by-default; test-only injection structurally barred from entry; Convex-passthrough verifier designed but not built (no official mechanism).
- Reads enforce seller/buyer/participant/staff at the service layer with existence-hiding 404s; invite DTO is minimum-fields; seller DTO is display-only.
- No writes, no cutover, no payments, no deployments. Turso remains the read-validation target, not the source of truth.

