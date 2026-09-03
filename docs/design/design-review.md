# DealSure — Design & Accessibility Review (living document)

Initial pass 2026-09-03 using the Prudence `design-toolkit` skill
(frontend-foundations.md). Verified from repository inspection
(`src/pages/*`, `src/components/layout/AppShell.tsx`, `public/`); a live
browser pass should be scheduled when a dev environment is available.

Scope: spacing, typography, tokens, navigation, mobile/desktop layout,
forms, transaction cards, status indicators, empty/loading/error states,
dialogs, admin screens, accessibility, PWA behavior.

## What is working (preserve)

- Consistent design tokens via Tailwind v4 + shadcn/ui (`bg-background`,
  `text-muted-foreground`, `border-border`, `bg-primary/10`…).
- Mobile-first: sticky top bar with `env(safe-area-inset-top)`, bottom nav
  with `env(safe-area-inset-bottom)`, `min-h-dvh`, `max-w-5xl` content
  column, desktop sidebar at `lg:` breakpoint.
- Status vocabulary is centralized in `config.ts` `STATUS_LABELS` (single
  source of truth for status copy) — keep this in the target.
- PWA: install banner, offline chip, manifest, safe-area handling.
- Good primitives usage: `Badge`, `Button`, `Card`, `Input`, `InputOTP`,
  `Sheet`/`Dialog` available for dialogs.

## Findings

### F1 — Confirm-destructive-action affordances (design, MEDIUM)
`cancel`, `freeze`, dispute resolution, and refund decisions are
money-affecting, but the codebase has no confirmation dialog component in
use on these actions (AlertDialog exists in the UI kit but is not wired on
these flows). Add explicit confirmation dialogs (and, for admin finance
actions, MFA re-auth per security plan) before executing destructive
actions.

### F2 — Accessibility: form labels (MEDIUM)
- `Auth.tsx` email input uses a placeholder with `required` but no visible
  `<label>` (icon-only affordance). Screen readers get the placeholder only.
- OTP input relies on `InputOTP` primitives (these provide
  `aria-label`-able slots — wire labels + error association).
- Rule: every input needs an associated `<label>` (or `aria-label`), and
  errors must be announced/associated with fields (`aria-describedby`,
  `role="alert"`), not color alone.
- `TransactionDetail`/`CreateTransaction` forms should be spot-checked for
  labels during Phase 7/UI port.

### F3 — Accessibility: focus management (MEDIUM)
Bottom mobile nav and sidebar use `NavLink` — good. But keyboard traversal
of the bottom nav (fixed element) and focus after route change are
unverified; add visible focus styles (Tailwind focus-visible ring) and
verify tab order + no keyboard traps in dialogs.

### F4 — Loading/error/empty states (LOW-MEDIUM)
- Route-level `RouteLoading` spinner exists; `EmptyHint` exists for empty
  lists. `TransactionDetail` shows an indefinite spinner for query loading
  — add bounded loading with timeout/error/retry states (frontend-
  foundations: never an indefinite spinner as the only response).
- Mutation errors surface via sonner toasts in some flows and raw
  `Error.message` in others (`Auth.tsx` shows raw Convex error strings) —
  normalize to friendly, actionable error copy.

### F5 — Status indicators (LOW)
Status chips/labels exist but tone mapping (success/warning/danger per
status) is not centralized. Centralize a status→tone map next to
`STATUS_LABELS` so `PAYMENT_SECURED`, `DISPUTED`, `SETTLED`, `REFUNDED`
render consistently and are distinguishable without color alone (icon +
text).

### F6 — Admin screens (LOW)
`Admin.tsx`/`AdminDispute.tsx` render tables/lists; verify responsive
tables at 375px (horizontal scroll or card layout), touch targets ≥ 44px,
and label all admin form controls. Admin read access must stay server-
enforced regardless of UI hiding (already the case via `requireStaff`).

### F7 — Touch targets (LOW)
Bottom-nav items are ~40px tall with `py-1.5` at 10px font; bump
interactive targets to ≥ 44px where feasible.

### F8 — PWA verification (LOW)
Manifest + SW look correct; verify on-device: install prompt, standalone
launch, offline shell, safe areas, update flow (`app-update-ready`
event exists). Ensure `Cache-Control: no-store` on `/t/*` and financial
routes (see security L4).

### F9 — Motion (LOW)
Framer Motion is used; confirm `prefers-reduced-motion` is respected for
any entrance/exit animations.

## Accessibility checklist (frontend-foundations)

| Item | Status |
| --- | --- |
| Buttons for actions / links for navigation | pass (NavLink/Button usage) |
| Ordered heading structure | partial — verify per page |
| Image alternatives | partial — logo alt OK; verify evidence thumbnails |
| Form labels on all inputs | fail (F2) |
| Keyboard traversal of critical flows | not verified (F3) |
| Visible focus / no traps | not verified (F3) |
| Contrast | not verified (run automated check) |
| Errors announced, not color-only | fail (F2, F4) |
| Touch targets ≥ 44px | partial (F7) |
| Reduced motion | not verified (F9) |
| Zoom/reflow at 200% | not verified |

## Design tokens / consistency

Keep Tailwind v4 tokens as the system of record in the target. Do not
redesign the app; port existing components as-is into the data-access-layer
refactor. Any deviation from tokens must be an intentional, documented
exception.

## Review log

| Date | Scope | Skill | Result |
| --- | --- | --- | --- |
| 2026-09-03 | Initial audit (repo inspection) | design-toolkit | 9 findings; live pass pending |
| — | Phase 7 (transactions UI port) | design-toolkit | pending |
| — | Phase 14 (admin UI) | design-toolkit | pending |
| — | Phase 16 (cutover) | design-toolkit | pending |

## Three highest-impact fixes

1. F2 — accessible labels + error announcements on all forms (blocks
   important workflows for assistive-tech users).
2. F1 — confirmation dialogs on all money-affecting actions.
3. F4 — bounded loading/error/retry states on transaction detail.