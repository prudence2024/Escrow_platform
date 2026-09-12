# Server API Framework Decision (Phase 4)

Date: 2026-09-11. Scope: trusted Node API for the Turso track.

## Decision: Hono (+ @hono/node-server adapter)

Reuse Hono (already a dependency, v4.13.5) instead of adding Express.

| Criterion | Hono | Express | Verdict |
|---|---|---|---|
| Node runtime | Via `@hono/node-server` (one tiny adapter) | Native | Tie (one small dep) |
| TypeScript | First-class context typing, validators | Good, heavier types | Hono |
| Middleware | cors, body-limit, request-id, secure-headers, jwt in-core | Needs helmet/cors/extra deps | Hono |
| Validation | Direct zod (already a dep) in handlers; full envelope control | Same via middleware | Tie |
| Error handling | `onError`/`notFound` per app, typed responses | Central middleware | Tie |
| Security headers | `secureHeaders()` in-core | helmet (new dep) | Hono |
| Testing | `app.request()` — no sockets, ideal for vitest | supertest (new dep) | Hono |
| Deployment | Node now; workers/serverless later without rewrite | Node-focused | Hono |
| Footprint | +1 adapter dep | ~60 new packages | Hono |
| Team familiarity | Already used (`main.ts` static server) | — | Hono |

No second framework is kept: the Deno static `main.ts` is untouched (separate
concern, Vite/dist serving); the API server is a new Node entry
(`server/api/server.ts`, `npm run dev:api`). If a future deployment target
cannot run the Node adapter, re-evaluate — Hono apps port without rewrites.

## Auth bridge status (authoritative, Phase 4)

No officially supported Convex-session verification exists for a custom Node
server in the installed SDK (no verify/JWKS exports; no admin key in env).
Hand-rolled JWT verification was rejected as invented security-critical code.

Therefore: `ApiAuth` interface + `DenyAllAuth` default (protected routes 401
in real deployments) + `TestPrincipalAuth` for in-process tests only
(structurally barred from entry points by test). Designed future adapter:
forward the caller bearer to a Convex identity query and let Convex verify.
Health/readiness and the slug-capability invite preview stay available.

## Auth bridge outcome (Phase 5 research — classification inside)

Installed-SDK audit (see gap analysis §13) found a REAL, officially
surfaced mechanism:

- Convex Auth session tokens are RS256 JWTs (`@convex-dev/auth`
  `tokens.ts`): `iss` = deployment URL, `aud` = `"convex"`,
  `sub` = `"<userId>|<sessionId>"`, ~1h lifetime.
- The deployment serves OIDC discovery at
  `/.well-known/openid-configuration` via the official
  `auth.addHttpRoutes()` surface — public verification material, not
  reverse engineering.
- The frontend can forward the token via the official `useAuthToken()`
  hook (`@convex-dev/auth/react`).

Classification: **SUPPORTED_WITH_PROVIDER_CONFIGURATION** (not
SUPPORTED_NOW): it additionally needs a live Convex deployment serving
discovery, JWKS fetching/caching ops, the `jose` dependency (added), and
acceptance of the 1h revocation window (identical to the Convex backend's
own semantics — sign-out stops refresh, not outstanding access tokens).

Implemented: `server/auth/convexJwtVerifier.ts` (JWKS + issuer + audience +
expiry enforced; sub split; roles ONLY from an injected trusted loader,
unknown role strings filtered). Nine tests mint local RS256 tokens through
the identical code path (missing/malformed/expired/forged/valid/issuer/
sub-shape/role-source/role-filter). **Production wiring stays DenyAllAuth**
until a live deployment + reachability + ops review exist — no production
auth enabled on decode-ability alone.

Transport analysis: bearer credentials (no new cookies, so no new CSRF
surface). Web PWA: `useAuthToken()` + `Authorization` header; token lives
in the Convex client's existing browser storage (XSS exposure unchanged —
not worsened). Native/Expo: same bearer flow with OS secure storage; no
cookie dependence, no browser-only assumptions. Lifetimes: 1h access +
30-day rotating refresh (provider-managed). Replay risk bounded by
short-lived, audience-bound tokens over HTTPS; revocation = 1h window.

## Auth modes + development wiring (Phase 6)

- `API_AUTH_MODE=deny` (default everywhere, including dev): protected
  routes 401. `convex`: explicit opt-in requiring `CONVEX_ISSUER_URL`
  (explicit https, never guessed) + optional `CONVEX_AUDIENCE` (default
  `"convex"`, the audited value). Unknown mode values fail closed (throw).
- `convex` mode fetches OIDC discovery + JWKS at startup (10s timeout,
  shape-validated); ANY discovery/JWKS failure is startup-fatal — the
  server never runs degraded. Only `Authorization: Bearer` is read
  (never query/body/custom headers).
- Roles load from Turso `user_roles` via `tursoRoleLoader` (canonical
  vocabulary only; unknown strings dropped). Identity mapping is
  deterministic preserved-ID in development (importer keeps artifact IDs);
  an explicit persisted provider-subject mapping remains the cutover
  design. Role authority: Convex authoritative until cutover; the Turso
  mirror serves development API auth only after role parity (§12 scenarios
  tested: baseline/seller/operations/super_admin/multi-role/unknown-legacy).
- Production stays `deny` — development wiring succeeding changes nothing
  about production readiness (live discovery, reachability, ops review,
  role cutover, and MFA gates all still required).

## Read-only scope

Phase 4 implements reads only (transactions, invite preview, profiles) plus
health/readiness. All repository write methods throw; Convex remains
authoritative for every write. No traffic moves.
