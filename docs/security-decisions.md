# No Ojoro — Security Decisions

> Former working name: DealSure.

Treat this as a financial transaction system.

## Auth & sessions
- First-party sign-in via Convex Auth email-OTP and guest providers. Guests become
  real users when onboarding (profiles attach to `userId`).
- Role is stored on the user (`user` | `admin` | `ops`). Permissions are checked in
  every mutation via `requireUser` / `requireAdmin` / participant checks. Plain older
  anonymous users are treated as low-privilege.

## Server-authoritative money
- Monetary values are integer `*_kobo` (minor units). No floats.
- Payment success is only recognised in `payments.confirmPayment`, which simulates the
  provider webhook, verifies server-side, dedupes on `providerEventId`, and is idempotent
  on `idempotencyKey`. Frontend redirects never settle anything.
- Every payment/dispatch/accept/settle/refund/dispute mutation accepts an
  `idempotencyKey`; a replayed key returns the original result and writes no new entry.

## Sensitive data & links
- Public transaction links use a random, unguessable slug (base32 ULID + entropy). No
  sequential ids in public URLs.
- OTPs are random 6-digit codes with 3-minute TTL-expiry (config), attempt caps, and
  one-time use (fail-safe regeneration).
- No card data is ever stored; the provider layer never returns card details.

## Access control (IDOR/BOLA)
- Every document read/write checks ownership/participation or admin. Tests cover the
  permission boundaries.

## Data integrity
- `audit_logs` and `ledger_entries` are append-only. Corrections are reversing entries,
  never destructive edits.
- `transaction_status_history` captures every transition: actor, ts, old, new, reason.

## Secrets
- Frontend env has **no secrets**. Provider keys would live in Convex env (server-side
  `process.env`). This build ships a mock provider, so no real keys are required.

## Rate limiting & hardening (stack-adapted)
- On Convex, throttling/rate-limiting is enforced at the application layer in the auth
  flow (Convex Auth OTP provider handles code expiry/lookup) and will be extended for
  dispute/payment mutations. Uploaded evidence is size/MIME validated server-side;
  malware-scan integration point is noted as a TODO for a licensed partner.

## Monitoring
- The Convex dashboard acts as the error/observe surface for this build. Structured,
  secret-redacted logs recorded as convex console output + audit rows.
## Phase 2 addendum (2026-09-11, Turso track)
- Rate limiting is now actually enforced server-side via persistent
  `rate_limit_counters` + `RATE_LIMIT_POLICIES` (txCreate 20/hr,
  dispatch 5/hr/tx, disputeOpen 10/hr, disputeMessage 60/hr, accept 60/hr,
  roleChange 30/hr/admin). Email-OTP *verify* brute force is provider-managed
  (`authRateLimits`, 10 failed/hr). OTP-send, invite-lookup, and IP-based
  limits are honestly DEFERRED (no stable server key in current paths).
- Correction: the "evidence size/MIME validated server-side" line above
  remains aspirational � `disputes.addEvidence` still accepts a URL with a
  TODO scan. Real validation arrives with the private-storage presign flow
  (Phase 9). Do not rely on it today.
- Delivery OTP P0 fixed (CSPRNG + HMAC digest + 10-min TTL); guest powers
  removed server-side; Freebuff JWT retired; step-up MFA honestly blocked
  pending a capable authenticator. See Phase 2 report + authentication-decision.md �6.
