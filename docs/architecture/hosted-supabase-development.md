# Hosted Supabase Development Environment

Status: **IN PROGRESS — connection blocked pending project confirmation**
Last updated: 2026-09-04

## Decision

Phase 2 of the DealSure migration runs against a **hosted Supabase DEVELOPMENT
project** as the primary development database. Docker/local Supabase is no
longer a hard blocker; the local configuration (`supabase/config.toml`,
`supabase/seed.sql`) is kept for later local rehearsal/testing.

Constraints honoured:

- DEVELOPMENT ONLY. No production project, no real customer/financial data —
  synthetic development data only.
- Migrations under `supabase/migrations/` remain the single source of truth.
  No dashboard-only schema changes.
- No secrets in source, docs, or commits. Only the project reference is
  documented where appropriate.

## Connection method

- **MCP: unavailable.** This coding environment exposes no Supabase MCP tools,
  so the official Supabase CLI is used (CLI fallback per the approved plan).
- **CLI authentication:** the Supabase CLI is already authenticated to a
  Supabase account on this machine (credentials live in the OS user profile,
  never in the repository). No access token is stored or committed here.
- **Link status: NOT LINKED.** The repository is not yet linked to any
  project (`supabase/.temp/project-ref` absent). Two projects exist on the
  authenticated account:

  | Project name | Reference | Region | Created |
  |---|---|---|---|
  | `ndccitma2026` | `hbkgxxbwoagkgbrmqcfl` | North EU (Stockholm) | 2026-07-15 |
  | `desalmonandsteak` | `ybbwfeytvcvkvrizfdif` | West EU (Ireland) | 2026-02-24 |

  Neither project name identifies it as the DealSure development database.
  **BLOCKER:** linking and applying migrations to the wrong project would be a
  consequential action on an unrelated remote database, so no link/push has
  been performed. The account owner must confirm which reference is the
  DealSure DEVELOPMENT project (or create a dedicated one).

## Target verification checklist (once linked)

- [ ] `supabase link --project-ref <REF>` succeeds
- [ ] Project status healthy; PostgreSQL reachable (`supabase db status` style checks)
- [ ] Auth available; email sign-ups enabled with the development email flow
  (Supabase's built-in development SMTP until production email infrastructure
  is selected — the previously exposed Freebuff email credential is
  compromised and will NOT be reused)
- [ ] Storage available (evidence buckets come in a later slice)
- [ ] Realtime available
- [ ] `supabase gen types typescript` output committed under `src/lib/supabase/`
  (or `src/types/supabase/`)

## Schema layout (reviewed)

Two schemas, all structure in migrations:

- `public` — identity, transactions, delivery, disputes, notifications,
  payment_intents (read-only). RLS enabled on every table; explicit policies;
  no blanket `USING (true)` except the documented non-sensitive legal text
  (`terms_versions`).
- `internal` — server-only tables (`audit_logs`, `payment_events`,
  `provider_webhook_events`, ledger, settlements, refunds, `risk_flags`,
  `admin_notes`, OTP hashes, transition map) plus SECURITY DEFINER functions.
  Not exposed through the Data API; no table grants to anon/authenticated.

Money is integer minor units (`amount_minor bigint`, `currency char(3)`,
NGN kobo). The transactions state machine is DB-enforced via
`internal.allowed_transitions` + `internal.transition_transaction`.

## Migration review (2026-09-04) — defects found & fixed

Review against Prudence security + ecommerce-engineering guidance of the
six original migrations (`0001`–`0006`) found three defects, all corrected
before any database (local or hosted) receives them:

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | CRITICAL | `internal.can_view_transaction()` allowed ANY authenticated user to view ANY `PENDING_BUYER_ACCEPTANCE` transaction (comment claimed slug-holder access, but the function cannot see the slug) | Removed the clause (migration `0003`); invite access now goes through `public.get_transaction_by_slug(slug)` where the unguessable slug is the credential; returns a fixed safe column list, pre-acceptance states only |
| 2 | CRITICAL | Migration `0001` revoked schema USAGE on `internal`, but RLS policies/grants call `internal.*` SECURITY DEFINER helpers — every policy would error at runtime | `grant usage on schema internal to anon, authenticated` with documented reasoning (USAGE exposes names only, never data) |
| 3 | CRITICAL | Functions default to EXECUTE for PUBLIC; with fix #2 in place, any API role could call `internal.transition_transaction`, `post_double_entry`, `issue_delivery_otp`, `append_audit`, … (privilege escalation to financial state) | New migration `0007`: revoke all function EXECUTE from PUBLIC (internal + public schemas); re-grant only the read/role-check helpers to `authenticated`; invite RPC to `anon, authenticated`; `anon` revoked from every application table except `terms_versions` SELECT; self-service UPDATEs column-scoped (`profiles`, `notifications`) |

Additional design notes from the review (deferred, not defects):

- Draft editing: seller draft lifecycle needs an UPDATE policy constrained to
  `status = 'DRAFT'` + non-state columns before the frontend migration slice.
- Buyer-accept flow needs a server-side RPC (participant insert + transition)
  in the transaction-writes slice.
- Internal financial writes for Edge/backend code will arrive as public
  wrapper RPCs granted to `service_role` only, or a trusted direct connection —
  explicitly not granted at this layer (see `0007` header comment).
- `notifications` column write surface limited to `read_at`.
- `updated_at` columns are not trigger-maintained; the data-access layer must
  set them (documented for the reads/writes slice).

## Applying migrations (procedure, pending link)

```bash
supabase link --project-ref <CONFIRMED_DEV_REF>   # interactive, uses stored CLI auth
supabase db push                                  # applies supabase/migrations/* to hosted dev
supabase gen types typescript --project-id <CONFIRMED_DEV_REF> -o src/lib/supabase/database.types.ts
```

Destructive operations (reset/truncate/large delete) require an explicit
rehearsal decision before running — hosted databases are not disposable.

## Security boundary reminders

- `anon`/`authenticated`/`service_role` secrets and the database password are
  never printed, committed, or written to `.env*` files (`.env.example` keeps
  placeholders only).
- Synthetic seed data (`supabase/seed.sql`) is dev-only; it must be emptied or
  removed before any production deploy.
