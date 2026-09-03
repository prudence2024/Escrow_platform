# Prudence Codex Skills — Inventory

Location: `~/Desktop/prudence-codex-skills` (verified present 2026-09-03;
the variant path `prudence-codex skills` does not exist — only
`prudence-codex-skills`). Repository has 21 skill packs, each with a
`SKILL.md` plus `references/` (and some `schemas/`). Three directories
(`design-intelligence`, `ecosystem`, `research`) are data/state folders, not
skill packs.

## Skill packs

| # | Skill | Purpose (from frontmatter) | Relevant to DealSure? |
| --- | --- | --- | --- |
| 1 | `security` | Production security/launch-readiness: auth, databases, payments, webhooks, uploads, secrets, dependencies, headers, rate limits, backups, CI/CD | **YES — primary** |
| 2 | `ecommerce-engineering` | Server-authoritative commerce: checkout, payment verification, webhooks, idempotency, state machines, admin CMS | **YES — primary** |
| 3 | `session-security` | Secure session timeout: idle/absolute expiry, warning UX, cross-tab, server enforcement | **YES — auth phase** |
| 4 | `legal-business` | Pre-launch legal docs & issue spotting (ToS, Privacy, DPA, Refund Policy, MSA, insurance readiness; Nigeria NDPA/NDPR-aware) | **YES — compliance** |
| 5 | `design-toolkit` | Frontend design/implementation: tokens, responsive, accessibility, forms, failure states, performance | **YES — UI phases** |
| 6 | `system-breaker` | Adversarial engineering: question assumptions, break safely, verify, harden | YES — testing phases |
| 7 | `incident-response` | Observability, incident handling, recovery, status comms | YES — ops/Phase 16 |
| 8 | `support-triage` | Support ticket classification/routing, escalations | YES — support workflow later |
| 9 | `post-production` | Evidence-based post-launch audit/hardening (SEO, a11y, perf, security, metadata) | YES — pre-launch gate |
| 10 | `visibility` | SEO, AI-crawlability, sitemap/robots, analytics | Later (marketing) |
| 11 | `package-intelligence` | Evaluate libraries/packages before adoption | YES — when adding deps (e.g. supabase-js, Edge runtime) |
| 12 | `ai-assisted-engineering` | AI-assisted dev workflow: decompose requirements, verify agent output | YES — process |
| 13 | `context-engineering` | Construct/prioritize/compress agent task context | YES — process |
| 14 | `motion-interaction` | Purposeful web motion, reduced-motion support | Minor (Framer Motion usage) |
| 15 | `website-generation` | Reference analysis → production-quality websites | No (not rebuilding UI) |
| 16 | `three-d-web` | Three.js/R3F 3D web | No |
| 17 | `voice-audio` | Voice/audio capabilities | No |
| 18 | `knowledge-graphs` | Entity-relationship knowledge for agent systems | No |
| 19 | `memory-engineering` | AI memory systems | No |
| 20 | `research-intelligence` | Evidence-backed research | Occasional (provider docs) |
| 21 | `research` | Data folder (config/decisions/reports) | n/a — not a skill |

## References used this run

- `security/references/security-skill-source.md` — full control checklist
- `security/references/production-foundations.md` — backend/data/deployment contracts
- `ecommerce-engineering/references/operational-playbook.md` — checkout/webhook/idempotency procedures
- `design-toolkit/references/frontend-foundations.md` — UI/a11y checklist
- `session-security/SKILL.md` — session strategy for auth decision
- `legal-business/SKILL.md` — legal/compliance process
- `security/SKILL.md`, `ecommerce-engineering/SKILL.md`, `design-toolkit/SKILL.md` — workflows