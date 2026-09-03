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