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

## Read-only scope

Phase 4 implements reads only (transactions, invite preview, profiles) plus
health/readiness. All repository write methods throw; Convex remains
authoritative for every write. No traffic moves.
