# Prudence Codex Skills — Usage Log

Continuous record of which skills were applied to which DealSure work
(per the brief's "skills are continuous project guidance" rule). Each row:
date, scope, skills read, how applied, outputs.

## 2026-09-03 — Pre-migration audit (this run)

| Scope | Skills applied | How applied | Outputs |
| --- | --- | --- | --- |
| Repository & security audit | `security` (SKILL.md, security-skill-source.md, production-foundations.md) | Ran the control checklist against the codebase: secrets/env, auth/session, validation, DB security, rate limits, headers, uploads, observability, dependencies, backups, idempotency | `docs/security/pre-migration-security-review.md` (C1–C2, H1–H5, M1–M6, L1–L7), `docs/security/security-review.md` |
| Commerce/payment flow review | `ecommerce-engineering` (SKILL.md, operational-playbook.md) | Applied checkout/webhook/state-machine/idempotency procedures to `payments.ts`, `settlement.ts`, `disputes.ts` | H3 (over-refund), H5 (client-triggered verify), state-machine mapping in `convex-to-postgres-map.md` |
| Auth decision | `session-security` (SKILL.md) | Session/MFA/recovery strategy for the auth decision | `docs/architecture/authentication-decision.md` |
| UI/accessibility | `design-toolkit` (SKILL.md, frontend-foundations.md) | a11y/form/state/consistency checklist vs pages and AppShell | `docs/design/design-review.md` (F1–F9) |
| Legal/compliance | `legal-business` (SKILL.md) | Issue-spotting process; labelled open questions; no legal advice represented as such | `docs/legal-compliance-questions.md` |
| Process | `ai-assisted-engineering`, `context-engineering` (SKILL.md) | Structured decomposition, provenance of findings (verified vs assumed) | this run's docs |

## 2026-09-04 — Phase 2: hosted-Supabase switch, migration review (this run)

| Scope | Skills applied | How applied | Outputs |
| --- | --- | --- | --- |
| DB/RLS design review | `security` (production-foundations.md), `ecommerce-engineering` (SKILL.md) | Reviewed all six Phase-2 migrations against DB design + RLS + money + idempotency controls before any apply; found + fixed 3 CRITICAL defects (invite-visibility RLS hole, missing schema USAGE for RLS helpers, default PUBLIC function EXECUTE on SECURITY DEFINER financial functions); wrote hardening migration 0007 (grant scoping, anon revokes, column-limited self-updates) | `supabase/migrations/20260903000001…07`, `docs/architecture/hosted-supabase-development.md` |
| RLS negative testing | `security` (authorization), `system-breaker` (negative-test mindset) | Authored positive/negative RLS suite (stranger isolation, impersonation, role escalation, anon enumeration, invite RPC scoping, staff boundaries) as a transactional psql script for the completion gate | `supabase/tests/rls_authorization.sql` |
| Auth | `security`, `session-security` (planning for hosted dev) | Confirmed Supabase Auth for all users incl. dev email flow; compromised Freebuff email key NOT reused | hosted-supabase-development.md |
| Safety review | `security` (hosted-DB safety) | No destructive/remote actions taken; link + push deliberately withheld until the target development project is confirmed by the account owner (noted as blocker) | this run's report |

## 2026-09-05 — Pre-push migration re-review (this run)

| Scope | Skills applied | How applied | Outputs |
| --- | --- | --- | --- |
| Migration portability re-review | `security` (production-foundations.md), `ecommerce-engineering` (SKILL.md) | Re-read migrations 0001–0007 end-to-end before any remote push; verified TRUNCATE guards are statement-level (the only supported form); removed the Docker-only `grant dealsure_owner to postgres` hack (hosted runner is superuser; no Docker hacks kept in source); re-verified the five previously fixed issues (no pending-tx enumeration, slug-as-capability invite, RLS helper USAGE, no PUBLIC execute on privileged functions, anon surface = invite RPC + terms) | `docs/architecture/database-ownership-decision.md`, edits to migration 0001 |
| Ownership model | `security` (ownership/definer guidance) | Decided to keep the NOLOGIN `dealsure_owner` role (SECURITY DEFINER blast radius below superuser) over collapsing onto `postgres`; documented rationale, alternatives, and the local-replay operational step | `docs/architecture/database-ownership-decision.md` |
| Env safety | `security` (secrets) | `.env.example` now carries `VITE_SUPABASE_PUBLISHABLE_KEY` (browser-safe modern name) with legacy `VITE_SUPABASE_ANON_KEY` as a temporary alias; server secrets remain server-only | `.env.example` |

## Planned future usage (map to phases)

| Phase | Skills to apply |
| --- | --- |
| 2–3 (Supabase env, schema) | `security` (DB), `package-intelligence` (supabase-js, edge runtime) |
| 4 (auth) | `security` (auth), `session-security` |
| 5 (RLS) | `security` (DB/RLS) |
| 8 (delivery/OTP) | `security` (uploads/OTP) |
| 10 (payments/webhooks) | `security`, `ecommerce-engineering` (webhook procedure) |
| 11 (ledger/settlement) | `ecommerce-engineering`, `security` |
| 12 (storage) | `security` (file uploads) |
| 13 (realtime) | `security` (realtime RLS) |
| 14 (admin) | `security` (authz), `session-security` (MFA re-auth) |
| 15–16 (reconcile/cutover) | `system-breaker` (negative testing), `incident-response` (rollback), `security`, `post-production` |
| Any UI change | `design-toolkit`, `motion-interaction` (reduced motion) |

## Rule of thumb

Before each phase: identify relevant skills (above), read the instructions,
classify safety (skills-safety-review.md), apply guidance, document
findings, implement, then re-run the relevant review. Findings that
contradict a skill recommendation are recorded here with a reason.