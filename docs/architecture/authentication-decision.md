# DealSure — Authentication Decision

Status: decision record (2026-09-03). Applies to the Supabase migration
(`architecture/supabase-migration` branch).

## 1. Current auth (verified)

- **Convex Auth** (`@convex-dev/auth`): providers = email OTP
  (`src/convex/auth/emailOtp.ts`, 6-digit code, 15 min TTL, delivered via
  Freebuff `send_otp`) + Anonymous (guest) provider.
- **Freebuff federated JWT**: `auth.config.ts` registers the Freebuff issuer
  as a `customJwt` provider (RS256, JWKS) so a freebuff.com-signed token
  (from the VLY toolbar) authenticates into the project without local sign-in.
- Sessions are Convex Auth sessions (opaque, DB-backed in Convex auth
  tables). Roles (`user|seller|admin|ops`) live on the Convex `users` row.
- **No Clerk exists anywhere in the repository.** OPTION A of the brief
  (Clerk for customers + Supabase Auth for admins) is therefore not
  applicable — there is nothing to keep.

## 2. Decision

### OPTION B — ONE identity system: Supabase Auth for everyone

All users — buyers, sellers, and every staff role — authenticate with
**Supabase Auth** (email OTP passwordless + anonymous upgrade path). Staff
accounts additionally require **MFA (TOTP)**. Supabase remains the single
identity provider; there is no second identity system.

Why:

- The current auth is stack-bound to Convex (sessions, verification codes,
  and the `users` table live in Convex). Convex is being retired; keeping
  Convex Auth after cutover is impossible.
- Choosing Supabase Auth now avoids a third migration (Convex Auth → Clerk →
  Supabase) and keeps the identity model uniform for staff and customers,
  satisfying the brief's "ONE identity provider" principle.
- Email-OTP passwordless maps 1:1 to the current UX (no password reset
  flows to port, no password hashing to migrate).
- MFA (TOTP) is natively supported for staff, closing the current gap where
  admin accounts have no second factor.

Explicitly **rejected**:

- Clerk for customers + Supabase Auth for admins (two identity systems;
  no documented architectural requirement; highest migration cost).
- Keeping Convex Auth as the long-term provider (blocks Convex retirement).

### Migration cost

| Item | Assessment |
| --- | --- |
| Users | Email-OTP identity is portable: the same email signs in to Supabase; `migration_identity_map` links Convex user id → new `profiles.id` |
| Sessions | Supabase JWT sessions (httpOnly cookie via SSR helpers, access + refresh rotation) replace Convex sessions |
| Anonymous users | Convex guests have no email; they become regular Supabase users at cutover and keep their data via identity map; guests who never onboarded may be left as unlinked anonymous users (decision: convert all, flag unverified emails in reconciliation) |
| Freebuff federated JWT | Needs a bridge: an Edge Function validates the Freebuff JWT (JWKS) and provisions/links a Supabase user, then returns a session. **Open decision** — confirm the toolbar still needs this in production |
| Role data | Migrated from `users.role` into `user_roles` (DB-backed) — see below |
| Email delivery | OTP delivery via Freebuff `send_otp` remains possible; the API key must move to a server secret (currently hardcoded — CRITICAL finding) |

### Security impact

- MFA for staff (new control; none today).
- DB-authoritative roles replace the single `users.role` column.
- Session tokens in httpOnly cookies (never localStorage) per Supabase SSR
  pattern.
- Rate limiting/attempt tracking moves to Supabase Auth's built-in OTP
  handling + Edge Function guards.

### User migration impact

- Users re-authenticate with the same email → same account (identity map).
- No password change for users (passwordless). Anonymous guests upgrade at
  first Supabase sign-in with an email.
- Staff re-enroll TOTP MFA at cutover.

## 3. Role & authorization model (target)

- `public.user_roles(profile_id, role, granted_by, granted_at, revoked_at)`.
- Roles: `buyer`, `seller`, `support_agent`, `dispute_agent`,
  `operations_admin`, `finance_admin`, `super_admin`.
- Default: every profile gets `buyer` + `seller`; staff roles granted by
  `super_admin` only, via an audited server function.
- A user can be both buyer and seller (as today).
- `is_staff(profile_id)` = any staff role.
- **Never** authorize by email, frontend route, localStorage, React state,
  query string, or client-editable JWT metadata. JWT contains only
  `sub`/session claims; roles are read from the DB on every authorization
  decision (server-side).

### Convex role → target role mapping (migration)

| Convex role | Target `user_roles` |
| --- | --- |
| `admin` | `super_admin`, `operations_admin`, `finance_admin` |
| `ops` | `operations_admin`, `dispute_agent`, `support_agent` |
| `seller` | `seller`, `buyer` |
| `user` | `buyer` |

## 4. MFA / session / recovery strategy

- **MFA**: TOTP via Supabase Auth, required for all staff roles; enforced at
  login and on sensitive admin actions (re-auth for role grants, refunds,
  freezes).
- **Session**: Supabase Auth with httpOnly, Secure, SameSite cookies;
  access token short-lived (15 min) with refresh rotation; server-side
  session validation on every Edge Function call; cross-tab coordination for
  expiry warnings (session-security skill).
- **Recovery**: email-OTP recovery for users (Supabase built-in); staff
  recovery via MFA backup codes + super_admin manual re-grant (audited).

## 5. Open decisions requiring owner input

1. Freebuff federated JWT bridge — keep or drop in production?
2. `profiles.id = auth.uid()` (recommended, single identity) vs separate
   profile UUIDs keyed by `(auth_provider, auth_subject)` (needed if we must
   support multiple identity providers simultaneously). Recommendation:
   `profiles.id = auth.uid()` with `auth_provider`/`auth_subject` columns for
   traceability.
3. Whether anonymous guest accounts that never onboarded migrate at all.

## 6. Phase 2 outcome — Turso track (`architecture/turso-startup`)

Historical §§1–5 above are preserved as written (Supabase-track context).
This section records what Phase 2 implemented/decided on the active track.
Nothing here modifies the frozen Supabase reference branch.

- **Provider (Decision A):** Convex Auth kept. No second provider, no
  homemade auth. Abstraction added: `src/lib/auth/types.ts`
  (`AuthenticatedPrincipal`, `AuthSession`, `AuthService`),
  `src/lib/auth/policy.ts` (canonical roles, legacy map, capabilities,
  tx-context guards, step-up registry), `src/convex/authService.ts`
  (`ConvexAuthService`), `src/convex/authz.ts` (server guards),
  `src/lib/auth/client.ts` + `useAuth().principal` as the UI seam
  (raw `user` row retained for compatibility; new code prefers `principal`).
- **Freebuff (Decision B): RETIRED from the auth trust path.**
  `auth.config.ts` no longer trusts the `customJwt` Freebuff issuer;
  `VLY_CONVEX_AUTH_ISSUER` removed from `.env.example`. Verified: no
  DealSure sign-in flow depends on it (only the dev preview/toolbar embed
  used federated identity; email delivery via `send_otp` is transport, not
  trust, and is unchanged). Takes effect on next Convex deploy. Also see
  `docs/architecture/freebuff-jwt-retirement.md` outcome note.
- **Transport (Decision C):** Convex Auth mechanism unchanged; `AuthService`
  is transport-neutral. Target recorded: web → provider-backed HttpOnly
  cookies; native → short-lived provider bearer flow. Not implemented yet.
- **Guests (Decision D): SANDBOX ONLY, enforced server-side.**
  `requireNonGuestUser` now gates: tx create/publish/accept/cancel/
  markReady/settle, payment request/confirm, dispatch/delivery-confirm,
  dispute open/message/evidence, bank accounts, KYC submit. Reads,
  notifications, and profile contact updates remain available.
- **Roles (Decision E):** canonical vocabulary
  buyer/seller/merchant/support/dispute_agent/operations/finance/
  super_admin in `policy.ts`; legacy map user→[], seller→[seller],
  ops→[operations], admin→[super_admin] (temporary elevated compat —
  narrow in Phase 15). Buyer/seller enforced as tx-context
  (`sellerId`/`buyerId`/participant), staff as global capabilities
  (§10 list). Forged/unknown role values resolve to zero roles.
- **Email OTP review (§7):** CSPRNG 6-digit + 15-min TTL confirmed in code.
  Provider-managed: code storage/hash, single-use, verify throttling
  (`authRateLimits`, 10 failed/hr default — verified in
  `@convex-dev/auth` `verifyCodeAndSignIn.ts`). DealSure-managed: generic
  errors, fail-closed send. Gaps documented: send/resend throttling has no
  provider hook (`sendVerificationRequest` receives no ctx) →
  DEFERRED_TO_API_GATEWAY + UI cooldown only; session expiry/rotation
  internals are library-opaque (`AuthSession.expiryUnknown: true` —
  no UI countdown is promised).
- **Rate limits (§8, enforced):** persistent `rate_limit_counters` table +
  `RATE_LIMIT_POLICIES`: txCreate 20/hr, dispatch 5/hr/tx, disputeOpen
  10/hr, disputeMessage 60/hr, accept 60/hr, roleChange 30/hr/admin.
  Deferred honestly: OTP send, invite lookup (read-only query), IP-based.
- **Session policy (§9):** Convex Auth sessions are provider-managed;
  logout via `signOut`; revocation semantics are library-internal
  (`revocable: true` as designed, not independently verified — re-verify
  when the Node API lands). No 60s warning is promised because expiry is
  not exposed. Idle/absolute policy + cross-tab coordination belong to the
  future Node session design.
- **MFA/step-up (Decision F, §11): HONESTLY BLOCKED, not faked.**
  `STEP_UP_ACTIONS` (role.change, refund.approve, settlement.authorize,
  payout_destination.change, dispute.resolve_high_value,
  super_admin.action) enforced by `requireStepUp`: denies in production
  (`STEP_UP_ENFORCED=true`) with `STEP_UP_REQUIRED`; writes an explicit
  `STEP_UP_DEFERRED` audit record in dev. Wired into `profile.setRole`
  and the dispute refund branch. Production privileged access stays
  BLOCKED pending an MFA-capable authenticator.
- **Delivery OTP (Decision G): FIXED.** CSPRNG (`generateSecureNumericCode`,
  rejection-sampled) + HMAC-SHA256 digest keyed by
  `DELIVERY_OTP_HASH_SECRET` with per-record context
  (`transactionId:deliveryId`); digest-only storage (`codeDigest`);
  10-minute default TTL (`DELIVERY_OTP_TTL_SECONDS`, 1h ceiling);
  single-live-code supersede; one-time dev reveal gated by explicit
  `DELIVERY_OTP_DEV_REVEAL=true` (default off, never logged); OTP success
  does not settle funds. Legacy plaintext rows fail closed.
- **Headers/CORS (§12):** `main.ts` (actual static layer) now sends
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options:
  SAMEORIGIN`, minimal `Permissions-Policy`. Strict CSP is documented as
  deployment-proxy work (recommended policy to be finalized with asset
  hashes) — not hard-coded to avoid breaking provider scripts.
- **postMessage (§13):** outbound announce only when embedded; inbound
  `navigate` commands restricted to same-origin + `VITE_TRUSTED_EMBED_ORIGINS`
  allowlist (previously `*`).
- **Tests (§14–15):** vitest harness (`npm test`); 33 tests across
  policy/OTP/rate-limit/client-mapping — all passing (see Phase 2 report).

## 7. Phase 5 outcome — auth bridge (research + tested adapter, not wired)

- Installed-SDK audit classified the Convex bridge as
  SUPPORTED_WITH_PROVIDER_CONFIGURATION (RS256 JWT + official OIDC
  discovery + `useAuthToken()`; details in `server-api-decision.md`).
- `ConvexJwtVerifier` verifies signature/issuer/audience/expiry and splits
  `sub`; roles load ONLY from an injected trusted store (unknown strings
  filtered). Nine tests cover missing/malformed/expired/forged/valid/
  issuer-mismatch/malformed-sub/role-source/role-filtering.
- Production behavior UNCHANGED (DenyAllAuth): no live Convex deployment,
  JWKS reachability, or ops review exists in this environment.
- Bearer transport analysis (no new cookies/CSRF; PWA token storage
  unchanged; native-compatible via secure storage; 1h revocation window
  identical to Convex semantics) recorded in `server-api-decision.md`.