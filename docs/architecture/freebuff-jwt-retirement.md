# DealSure — Freebuff Federated JWT: Assessment & Retirement

Status: **RETIRE — Supabase Auth becomes the single identity system.** The
bridge is retained in code only until the equivalent Supabase authentication
flow passes tests, then removed (per approved decision #3).

## 1. What the bridge does (verified)

- `src/convex/auth.config.ts` registers a second Convex Auth provider of type
  `customJwt` for the Freebuff issuer:
  - issuer: `process.env.VLY_CONVEX_AUTH_ISSUER` (default
    `https://auth.freebuff.app`);
  - signing: RS256;
  - JWKS: `${issuer}/api/web/.well-known/jwks.json`;
  - applicationID: `vly-convex`;
  - requires tokens to carry a `kid` header (the `customJwt` validation path).
- The comment in the file states the token is minted by "freebuff web's
  `src/lib/vly-convex-jwt.ts`" — **that file is not in this repository**; the
  token is issued by the Freebuff platform, not by DealSure code.
- Purpose (from the code comment): "let a signed-in freebuff.com user carry
  their identity into this project without going through local sign-in".

## 2. Is there a genuine product requirement?

**No product feature in this repository consumes the bridge.**

Evidence:
- The only Freebuff-platform surface in the repo is the **development
  toolbar** (`vly-toolbar-readonly.tsx`) and the `VlyToolbar` dev overlay,
  which gate on `window.location.hostname.endsWith(".vly.sh")` and
  `window.self === window.top` — i.e. Freebuff's **preview/development**
  environment.
- There is no production UI path, route, or API that requires a
  freebuff.com-signed token to function.
- The local sign-in path (`email-otp` + anonymous) is complete and used by
  the app UI.

Conclusion: the bridge exists to support prototype/development
authentication on the Freebuff platform. Per approved decision #3, it is
**retired** as Supabase Auth becomes authoritative.

## 3. What gets retired and when

| Item | Action | When |
| --- | --- | --- |
| `customJwt` provider in `auth.config.ts` | remove | after Supabase Auth sign-in/up E2E passes (Phase 4 completion gate) |
| `VLY_CONVEX_AUTH_ISSUER` env | remove from `.env.example` | same time |
| `vly-convex` JWT acceptance in Convex Auth | remove | same time |
| Convex Auth itself | remove | Phase 17 |

Do **not** delete the current implementation before the equivalent Supabase
authentication flow passes tests (approved decision #3).

## 4. Documentation of the bridge (for the record)

| Property | Value / evidence |
| --- | --- |
| Exact dependency | Convex Auth `customJwt` provider in `auth.config.ts` |
| Issuer | `https://auth.freebuff.app` (env: `VLY_CONVEX_AUTH_ISSUER`) |
| Signing method | RS256 |
| Key source | JWKS at `${issuer}/api/web/.well-known/jwks.json` |
| Required header | `kid` (customJwt path rejects tokens without it) |
| Application id | `vly-convex` |
| Token claims | minted by freebuff web `src/lib/vly-convex-jwt.ts` — **not verifiable from this repo**; confirm with Freebuff platform if ever required again |
| Token lifetime | not verifiable from this repo |
| Verification process | OIDC-less customJwt: JWKS lookup + RS256 verify + issuer/audience/app checks (Convex Auth implementation) |
| Security implications | trusts a third-party issuer's tokens as valid DealSure identities; any Freebuff-issued token satisfying the checks authenticates |
| Migration path | Supabase Auth (email OTP + anonymous + staff MFA) becomes the sole issuer; Freebuff tokens no longer accepted |

## 5. Future need check

If a future production requirement genuinely needs Freebuff single sign-on,
re-evaluate with the Freebuff platform team, document the claim set and
lifetime, and implement it as a proper OAuth/OIDC provider on Supabase Auth —
not a custom JWT bridge.