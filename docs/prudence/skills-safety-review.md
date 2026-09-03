# Prudence Codex Skills — Safety Review

Classification of each skill pack **before any execution**. Per project
policy: a skill is guidance, not unquestionable authority. Any script or
command from a skill is inspected before running. No skill found in the
repository is executed automatically; none was found to contain remote
scripts or destructive commands aimed at this project.

## Classification

- **SAFE** — read guidance, apply to code/docs, no elevated risk.
- **REVIEW_REQUIRED** — may touch real systems/credentials; inspect each
  action first.
- **HIGH_RISK** — can delete/alter important data or external systems.
- **DO_NOT_EXECUTE** — violates project policy.

| Skill | Class | Rationale |
| --- | --- | --- |
| `security` | SAFE (guidance) / REVIEW_REQUIRED (any provider/dashboard action) | Reading is safe; its checks reference provider dashboards and live endpoints — those actions need authorization and are never performed against production here |
| `ecommerce-engineering` | SAFE | Guidance only; its playbook explicitly requires approval for real payments/destructive ops |
| `session-security` | SAFE | Design/audit guidance |
| `legal-business` | SAFE | Drafting/issue-spotting only; never publishes documents without owner approval |
| `design-toolkit` | SAFE | Design guidance |
| `system-breaker` | REVIEW_REQUIRED | Adversarial testing must stay inside the owned/local environment with bounded scope |
| `incident-response` | SAFE | Process guidance; production incident response requires authorization |
| `support-triage` | SAFE | Process guidance |
| `post-production` | SAFE | Audit checklist |
| `visibility` | SAFE | SEO guidance |
| `package-intelligence` | SAFE | Evaluation guidance |
| `ai-assisted-engineering` / `context-engineering` | SAFE | Process guidance |
| `motion-interaction` | SAFE | Animation guidance |
| `website-generation`, `three-d-web`, `voice-audio`, `knowledge-graphs`, `memory-engineering`, `research-intelligence` | SAFE / not applicable | Not used for DealSure core work |

## Standing guardrails (from the brief, applied)

Never execute anything that:

- deletes important files or rewrites Git history;
- destroys databases (no `supabase db reset` against production; local only
  and only within this project);
- accesses production without authorization;
- uploads source code externally or prints environment secrets/API keys;
- disables security controls, bypasses tests, or weakens authentication;
- runs unknown binaries or remote scripts (none encountered);
- exposes Supabase service-role keys, Clerk/Convex/Freebuff secret keys, or
  payment secrets;
- disables RLS or broadens policies without a documented reason.

Any future script added to `scripts/migration/` or `supabase/` will be
reviewed in code review before execution against real data.

## Script inventory (repo)

- No scripts exist in the repo yet (`scripts/` will appear with the
  migration pipeline in Phase 2+; each will be reviewed on creation).
- No Prudence-provided scripts were executed this run. All conclusions came
  from reading `SKILL.md`/`references/*.md` and applying their checklists to
  the repository.