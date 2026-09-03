# DealSure — Security Review (living document)

Graded findings tracked across the migration. This document is updated after
every sensitive phase (auth, RLS, database, payments, settlement, admin).
CRITICAL blocks production deployment. See
`docs/security/pre-migration-security-review.md` for the initial audit and
full threat mapping; this file tracks status/closure.

## Severity legend

CRITICAL — blocks deployment · HIGH — must fix before cutover ·
MEDIUM — should fix · LOW — hygiene/informational

## Open findings

| ID | Severity | Finding | Status | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| C1 | CRITICAL | Hardcoded Freebuff email API key in `auth/emailOtp.ts` | OPEN — fix in Phase 0/4 | eng | Rotate key; move to `process.env` |
| C2 | CRITICAL | No test suite | OPEN — Phase 0+ | eng | vitest + RLS tests + E2E gates |
| H1 | HIGH | Delivery OTP stored plaintext | OPEN — Phase 8 | eng | Hash at migration import |
| H2 | HIGH | OTP generated with `Math.random` | OPEN — Phase 8 | eng | CSPRNG |
| H3 | HIGH | Partial refund unbounded | OPEN — Phase 11 | eng | DB cap + server check |
| H4 | HIGH | Dependency vulns (undici, @auth/core) | OPEN — ongoing | eng | track upstream; re-audit per phase |
| H5 | HIGH | Client-triggered payment verification pattern | OPEN — Phase 10 | eng | provider API/webhook only |
| M1 | MEDIUM | `.gitignore` misses `.env` | **CLOSED 2026-09-03** | eng | `.env*` added; `.env.example` created |
| M2 | MEDIUM | Auth error leaks axios detail | OPEN — Phase 4 | eng | generic client error |
| M3 | MEDIUM | No rate limiting | OPEN — Phases 4/10 | eng | Edge Function limits |
| M4 | MEDIUM | Admin queries materialise large sets | OPEN — Phase 14 | eng | SQL pagination |
| M5 | MEDIUM | users.email not unique in Convex | OPEN — Phase 3 | eng | partial UNIQUE in Postgres |
| M6 | MEDIUM | Share-link pre-acceptance exposure | OPEN — review | product | acceptable by design; rate-limit detail |
| L1–L7 | LOW | Hygiene items (see pre-migration review) | OPEN — as phases allow | eng | — |

## Phase review log

| Date | Phase / scope | Skills applied | Result | Blocker? |
| --- | --- | --- | --- | --- |
| 2026-09-03 | Pre-migration audit | security, ecommerce-engineering | 2 CRITICAL, 5 HIGH, 6 MEDIUM, 7 LOW | yes — C1, C2 |
| — | Phase 4 (auth) | security, session-security | pending | — |
| — | Phase 5 (RLS) | security | pending | — |
| — | Phase 10 (payments) | security, ecommerce-engineering | pending | — |
| — | Phase 11 (ledger/settlement) | security, ecommerce-engineering | pending | — |
| — | Phase 14 (admin) | security | pending | — |
| — | Phase 16 (cutover) | security, testing | pending | — |

## RLS negative-test status

The 12 required negative tests (buyer-A/B isolation, no payment-event
inserts, no client settlement/refund, audit-log isolation, no role grants,
no self-promotion, staff least-privilege, anonymous enumeration) are
specified in `docs/architecture/database-boundaries.md`. Status: **not yet
implemented** — automated suite lands in Phase 5 and is re-run after every
sensitive phase.

## Recurring checks per phase

1. `npm audit` / `bun audit` — dependency drift.
2. Secret scan: `rg` for `sk_|pk_|x-api-key|password|secret` in tracked
   files (excluding docs that cite this review).
3. RLS negative tests (after Phase 5).
4. Ledger balance test (after Phase 11).
5. E2E financial flows (after Phase 10/11/16).
6. PWA caching audit (no financial response caching).