# DealSure — Pre-Migration Security Review

Conducted 2026-09-03 against commit `62a6a81` using the Prudence `security`
skill (security-skill-source.md + production-foundations.md) and the
`ecommerce-engineering` operational playbook (webhook/idempotency/state
machine). Findings are labelled **confirmed / likely / informational** and
graded CRITICAL / HIGH / MEDIUM / LOW.

**A CRITICAL finding blocks production deployment.** No production Convex
deployment was touched during this review; all findings are from repository
inspection + local baseline runs.

---

## CRITICAL

### C1 — Hardcoded email API key committed to source
- Location: `src/convex/auth/emailOtp.ts` — `"x-api-key":
  "fb_email_2crN1hqIArZP2bEfvjp5Qik4"` (Freebuff `send_otp`).
- Evidence: confirmed (repository inspection).
- Impact: anyone with repo access can send OTP emails through the Freebuff
  endpoint (spam/abuse, quota exhaustion, and the key is effectively leaked
  if the repo is ever shared/public).
- Remediation (Phase 0/4): move to `process.env.VLY_EMAIL_API_KEY`; rotate
  the exposed key with Freebuff; never fall back to a hardcoded default.
- Blocks: everything financial/launch. Do not ship this key.

### C2 — No test suite at all
- Evidence: confirmed (no `test` script; zero test files).
- Impact: no regression safety for a system handling real money; migration
  has no harness; RLS/payment/ledger invariants are unproven.
- Remediation: add test tooling in Phase 0/1 (vitest for unit, RLS SQL tests
  in Phase 5, E2E later). The plan requires tests as a gate per phase.
- Blocks: production cutover (Phase 16).

---

## HIGH

### H1 — Delivery OTP stored in plaintext
- Location: `src/convex/delivery.ts` — `codeHash: code` with an explicit
  `// dev: stored readable; production would hash (TODO)` comment.
- Evidence: confirmed.
- Impact: DB read (or Convex export) exposes usable delivery codes;
  violates the "secret at rest" invariant; also violates migration hygiene
  (plaintext would carry into Postgres).
- Remediation: HMAC-SHA256 (or Argon2id) with a server secret; verify in an
  atomic SECURITY DEFINER function; hash at migration import (Phase 8).
  Target design already mandates this.

### H2 — Delivery OTP generated with Math.random (not CSPRNG)
- Location: `src/convex/lib.ts` — `genCode()` uses `Math.random()`.
- Evidence: confirmed (contrast: `genPublicId`/`genSlug` use
  `crypto.getRandomValues`).
- Impact: 6-digit codes from a non-cryptographic PRNG may be predictable,
  weakening the delivery-confirmation control.
- Remediation: use `crypto.getRandomValues` for OTP digits (target `lib.ts`
  replacement + Edge Function).

### H3 — Partial refund has no upper bound
- Location: `src/convex/disputes.ts` `resolveDispute` — `refundAmount =
  refundKobo ?? 0` with only a `<= 0` check; no `<= tx.totalKobo` bound.
- Evidence: confirmed.
- Impact: an admin (or a compromised admin session) can issue a partial
  refund exceeding the secured amount → over-refund and ledger imbalance.
- Remediation: server-side bound check + DB trigger/CHECK
  (`refunds.amount_minor <= transactions.total_minor`); ledger posting must
  also cap at secured custody balance. Target mapping includes this guard.

### H4 — Dependency vulnerabilities (baseline)
- Evidence: `npm audit` = 8 vulnerabilities: 2 critical, 1 high, 1 moderate,
  4 low. Notable: `undici` (multiple advisories, **no fix available**) and
  `@convex-dev/auth` → vulnerable `@auth/core`.
- Impact: server-side request handling (undici) and auth stack exposure.
- Remediation: track upstream fixes; consider `--omit=dev`/runtime-only
  audit; revisit at each phase; re-audit before cutover. Note: installed via
  npm for baseline only — the committed lockfile is `bun.lock` (audit with
  `bun audit` when bun is available).

### H5 — `confirmPayment` lets the client trigger the payment-verification path
- Location: `src/convex/payments.ts` — buyer calls `confirmPayment` which
  invokes the provider `handleWebhook` simulation server-side.
- Evidence: confirmed (mitigations exist: server-side amount validation,
  idempotency, event id dedup — the state transition itself is server-side).
- Impact: with the mock provider this is safe, but the pattern must not
  survive into production: real payment success must come from a **signed
  provider webhook / provider API verification**, never from a client-
  initiated "confirm" call. Target design: `verifyPayment` in Edge Function,
  browser only calls a verify endpoint that consults the provider.
- Risk: HIGH for production cutover; the target architecture fixes it.

---

## MEDIUM

### M1 — `.gitignore` does not exclude `.env`
- Location: `.gitignore` — only `*.local`.
- Evidence: confirmed.
- Remediation: add `.env`, `.env.*`, `!.env.example`; create `.env.example`
  (done in Phase 1).

### M2 — `confirmPayment` error from `sendVerificationRequest` leaks axios detail
- Location: `src/convex/auth/emailOtp.ts` — `throw new Error(JSON.stringify(error))`.
- Evidence: confirmed (error surfaces to client).
- Remediation: log full detail server-side; throw a generic message
  (target auth port).

### M3 — No rate limiting beyond auth OTP
- Evidence: confirmed — no general rate limiting for dispute/payment/OTP-
  verify endpoints; OTP attempt caps exist for delivery codes only.
- Remediation: Edge Function rate limits (auth 5/15min, API 60/min,
  uploads 5/min, webhooks per-provider) + `Retry-After` on 429. Target
  Phase 4/10.

### M4 — Admin queries materialise large sets in memory
- Location: `admin.searchUsers` (`take(500)`), `transactions.list`
  (`take(300)` + JS filter), `admin.listDisputes` (`take(200)`).
- Evidence: confirmed.
- Impact: scalability + potential DoS on Postgres; not a data-exposure bug
  (staff only).
- Remediation: real SQL LIMIT/OFFSET + indexed filters in target.

### M5 — `users.email` index is not unique in Convex
- Evidence: confirmed (`schema.ts` index on `email`, not unique). Convex
  Auth manages its own uniqueness; the target `profiles.email` gets a
  partial UNIQUE constraint.
- Impact: informational for Convex; must be enforced in Postgres.

### M6 — Transaction share-link view exposure
- Location: `canViewTransaction` allows any authenticated user holding the
  unguessable slug to view a `PENDING_BUYER_ACCEPTANCE` transaction.
- Evidence: confirmed (by design — share link). Slug entropy is 96 bits
  (`randHex(12)`); no enumeration risk.
- Impact: pre-acceptance invitees see title/amount/description/seller
  email. Acceptable for the product model; target RLS reproduces it with
  the same caveat and rate-limited detail lookups.

---

## LOW / INFORMATIONAL

### L1 — `listProviders` mutation has no auth check
- `src/convex/payments.ts` — returns `[PROVIDER.mock]`; harmless today, but
  auth check should exist for consistency.

### L2 — Frontend console logging
- `Auth.tsx` logs `"signed in"` and error detail to console; `AppShell`
  uses `as any` casts. Hygiene + lint debt, no direct exploit.

### L3 — No CSP / security headers configured
- Vite dev/preview serves default headers; no `Content-Security-Policy`,
  `Strict-Transport-Security`, `X-Content-Type-Options` etc. configured.
  Target deployment (hosting platform) must set them.

### L4 — Service worker caches only static shell (good) but `Cache-Control`
      on transactional pages is not set
- No `no-store` on authenticated pages; browsers may BFCache sensitive
  pages. Target: `Cache-Control: no-store` on `/t/*` and financial routes.

### L5 — No backups/restore evidence
- No backup/DR policy documented for the Convex data or future Postgres.
  Target: automated backups + tested restore + PITR (see production-
  foundations skill).

### L6 — No observability integration
- Convex dashboard only; no error tracking, structured logs, or uptime
  alerts. Target: instrument Edge Functions (Sentry-compatible logging,
  structured logs, alerting).

### L7 — KYC/evidence upload validation is a TODO
- `disputes.addEvidence` comments note "MIME/size validation happens on the
  upload path (TODO partner scan)". No upload path exists yet; target
  Storage Phase 12 implements size/MIME/extension + malware-scan hook.

---

## Security threat checklist (mapped)

| Threat | Status today | Target control |
| --- | --- | --- |
| IDOR/BOLA | Function-level checks; no RLS | RLS + visibility helper + negative tests |
| Broken authentication | Convex Auth OK | Supabase Auth + MFA for staff |
| Role escalation | `setRole` admin-only, audited | `grant_role` super_admin-only + audit |
| JWT mistakes | Convex Auth handles | Supabase SSR httpOnly cookies; DB-authoritative roles |
| RLS bypass | n/a (no RLS) | No grants on internal; staff functions; tests |
| SQL injection | n/a (Convex) | Parameterised SQL only (Edge Functions/PostgREST) |
| XSS | No raw-HTML rendering found | keep; render user content as text |
| CSRF | Convex RPC same-origin | Supabase cookie auth + CSRF protections |
| Unsafe CORS | n/a today | Allowlisted origins |
| Insecure storage | No file storage in use | Private buckets, signed URLs, validation |
| Unsafe uploads | No upload path | Phase 12 controls |
| Webhook spoofing | Mock provider only | Signature verify on raw body |
| Webhook replay | Event-id dedup in confirmPayment | UNIQUE provider_event_id + signature |
| Payment duplication | Idempotency keys | UNIQUE (transaction_id, idempotency_key) |
| Double refund / double settlement | Guards in code | DB-level partial-unique + caps |
| Race conditions | Convex serializability | Row locks / transactional functions |
| OTP brute force | Delivery OTP attempt caps (non-atomic) | Atomic verify + rate limit |
| Service-role exposure | n/a | Secret never in frontend |
| Secret leakage | **C1 (email key)** | env-only + rotation |
| PII logging | `JSON.stringify(error)` leak (M2) | sanitized logs |
| Missing rate limits | M3 | Edge Function limits |
| Insecure admin actions | staff checks, no MFA | MFA + audited sensitive ops |
| Ledger corruption | balanced postings | DB balance trigger + tests + append-only |
| Transaction-state manipulation | transition map | DB transition function + CHECK |

## Three highest-risk launch blockers

1. **C1** — committed email API key (rotate + env-ify before anything ships).
2. **C2/H3/H5** — no tests, unbounded partial refund, and client-triggered
   payment verification must all be fixed before production money flows.
3. **H1/H2** — plaintext + PRNG delivery OTPs must become hashed, CSPRNG,
   atomic-verify in the target.