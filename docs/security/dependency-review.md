# DealSure — Dependency Review

Baseline and remediation of dependency vulnerabilities, run 2026-09-03 per
approved decision #18. Tooling: `bun audit` (bun 1.4.0 via `npx bun`),
`npm audit` (npm 10, used only to cross-check; committed lockfile is
`bun.lock`).

## Summary

| Point | Before | After |
| --- | --- | --- |
| `bun audit` | 48 vulnerabilities (1 critical, 20 high, 24 moderate, 3 low) | **1 vulnerability (1 low)** |
| `npm audit` | 8 vulnerabilities (2 critical, 1 high, 1 moderate, 4 low) | not re-run (bun.lock is authoritative) |
| `@auth/core` (critical) | 0.37.4 | **0.41.3** |
| `@convex-dev/auth` | 0.0.90 | **0.0.95** |
| `undici` | 5.29.0 / ≤6.27.0 (high) | **6.28.0** (override) |
| `react-router` | 7.16.0 (high) | **7.18.3** |
| `axios` | 1.16.1 (high) | **^1.18.0** |
| `hono` | 4.12.23 (high) | **^4.12.34** |
| `ws`, `postcss`, `nanoid`, `browserslist`, `js-yaml` | vulnerable transitive | **overridden to fixed versions** |

## Actions taken

1. **`@convex-dev/auth` `^0.0.90` → `^0.0.95`** — upstream fix for the
   `@auth/core` criticals; `@auth/core` overridden to `^0.41.3` (peer range
   of convex-auth 0.0.95 requires `^0.41.1`). Convex Auth remains in use
   during dual-run.
2. **Direct-dependency bumps** with fixes inside their majors: `axios`
   `^1.18.0`, `hono` `^4.12.34`, `react-router` `^7.18.2`.
3. **Overrides** (same-major, low risk): `ws ^8.21.0` (convex),
   `postcss ^8.5.23` (vite), `nanoid ^3.3.18` (postcss), `browserslist
   ^4.28.7` (babel/eslint), `js-yaml ^4.3.1` (eslint), `undici ^6.28.0`
   (AI SDK chain).
4. **Lockfile regenerated** with `bun install`; verified `tsc -b --noEmit`
   and `vite build` both pass with the new tree.

## Remaining findings

| Package | Severity | Direct/Transitive | Affected usage | Fix | Decision |
| --- | --- | --- | --- | --- | --- |
| `@ai-sdk/provider-utils@3.0.36` (GHSA-866g-f22w-33x8) | LOW | transitive via `@vly-ai/integrations > ai > @ai-sdk/gateway` | Uncontrolled resource consumption; **AI features are not used anywhere in DealSure** | none in the pinned AI SDK v3 range | **Accepted temporary risk.** Re-audit when `@vly-ai/integrations` or the AI SDK updates; revisit at Convex retirement when `@vly-ai/integrations` may be removed |

## Resolved-by-tooling-notes

- The earlier `npm audit` undici finding (no fix at the time) is resolved by
  the override to `6.28.0`; typecheck and production build pass with it.
- `brace-expansion` (eslint stack, dev-only DoS) no longer appears after the
  eslint-stack overrides; if it resurfaces on dependency churn, re-evaluate
  rather than overriding across majors.

## Standing policy

- Monthly `bun audit` as a standing reminder; CI should fail on
  critical/high (add when CI is set up).
- Never run `bun audit fix --force` / `npm audit fix --force` blindly.
- Any new dependency goes through the Prudence `package-intelligence`
  skill before adoption.
- This document is re-checked at the end of every phase
  (`docs/security/security-review.md` references it).