# Database Ownership Decision

**Status:** Decided — 2026-09-05
**Applies to:** `supabase/migrations/0001–0007` (foundation + hardening), pre-application re-review
**Branch:** `architecture/supabase-migration`

## Decision

Keep the dedicated **`dealsure_owner`** (NOLOGIN) role as the owner of the trusted
layer, and **do not** collapse ownership onto the platform `postgres` role. Keep the
`grant dealsure_owner to postgres;` membership grant in migration `0001` — it is a
**hosted requirement**, not a Docker workaround (see the corrected note below; this
document's 2026-09-05 first draft wrongly claimed hosted `postgres` is a superuser).

### The model in practice

| Object | Owner | Why |
|---|---|---|
| `public` application tables (profiles, transactions, …) | `dealsure_owner` | SECURITY DEFINER functions owned by the same role can read/write them while bypassing RLS **as a non-superuser**. Table owners bypass RLS (no `FORCE RLS`), which is what lets `transition_transaction`, `disputes_after_insert`, `refunds_before_insert`, etc. mutate state the API roles cannot. |
| `internal` schema + its tables (audit, ledger, OTPs, webhooks, settlements, refunds) | `dealsure_owner` | Schema is absent from PostgREST (`config.toml` exposes only `public`, matching the hosted default), so the tables have **no Data API surface at all**. No anon/authenticated table grants exist. |
| SECURITY DEFINER functions | `dealsure_owner` | Runs as a privileged-but-not-superuser role. A bug in one function cannot escalate to superuser. |
| Migration runner on hosted | platform `postgres` (NOT a superuser) | Supabase never grants superuser (`roles-superuser` docs). `db push` runs as this admin-not-superuser role. |

### Why a dedicated owner instead of "plain" ownership

The directive's alternative — "normal migration ownership + explicit GRANT/REVOKE +
RLS + SECURITY DEFINER functions" — was considered. Under that model the SECURITY
DEFINER functions would run as `postgres`, which hosted Supabase deliberately keeps
**non-superuser** (supabase.com/docs/guides/database/postgres/roles-superuser —
"Superuser access is not given"), yet which remains a broad platform-admin role.
Keeping `dealsure_owner` scopes trusted-layer execution below even that. The reviewed
migrations already rely on owner-bypass semantics (not `BYPASSRLS`, not per-table
grants) and were committed with the owner role, so keeping `dealsure_owner`:

1. preserves the reviewed, committed architecture (no wholesale rewrite of 7 files);
2. bounds SECURITY DEFINER blast radius below superuser;
3. keeps the Data API surface identical (RLS + grants, never ownership, is what the
   browser sees).

### What was changed in this re-review

- **Restored** `grant dealsure_owner to postgres;` in migration `0001` after
  verifying against Supabase's `roles-superuser` docs that **hosted `postgres` is not
  a superuser**. `ALTER ... OWNER TO dealsure_owner` requires the runner to
  administer the target role; because this migration *creates* `dealsure_owner`, the
  runner can grant itself membership, satisfying the check. The earlier "Docker-only
  hack" framing was wrong: the local `supabase start` image simply mirrors the
  platform's non-superuser `postgres`, and the local run proved this exact sequence
  (create role → self-membership grant → ALTER OWNER → GRANT/REVOKE on the owned
  schema) applies cleanly.
- **Confirmed** the append-only TRUNCATE guards in migrations `0001` (`audit_logs`) and
  `0006` (`ledger_entries`) are statement-level (`BEFORE TRUNCATE … FOR EACH
  STATEMENT`), which is the only supported form — PostgreSQL rejects row-level TRUNCATE
  triggers.
- **Confirmed** no other local-only patterns remain in the migration files.

### Local development note

The membership grant is intentionally *in source*: without it, `db push` to the
hosted development project fails at migration `0001` with `42501` (`must be able to
SET ROLE "dealsure_owner"`) — a failure mode first observed in local replay, which is
role-model-identical to hosted. Local Docker replay therefore also needs no
out-of-band step.

### Who owns / may touch what (summary)

- **API roles (`anon`, `authenticated`)** — never own anything. RLS policies gate every
  row read/write they can reach; column-scoped UPDATE grants limit self-service
  surfaces (migration `0007`). `anon`'s entire surface is `get_transaction_by_slug`
  (slug = capability) plus `terms_versions` SELECT.
- **`dealsure_owner`** — owns tables/functions; runs SECURITY DEFINER bodies; bypasses
  RLS by ownership; is NOLOGIN so it can never appear in a client session.
- **platform `postgres`** — non-superuser migration runner (admin privileges, no
  superuser); member of `dealsure_owner` via the migration's self-grant; owns the
  auth trigger on `auth.users`.
- **Future server layer (Edge Functions / wrapper RPCs)** — financial writes are
  intentionally *not* granted to `service_role` at the table level in this foundation;
  they arrive through reviewed wrapper RPCs in a later slice.

### Open items (not blockers for this decision)

- Supabase "auto-expose new tables" default privileges still grant `anon`/
  `authenticated` table access to *future* `public` tables created after this
  migration set. Any later migration that adds a `public` table must REVOKE or rely on
  RLS explicitly (migration `0007` documents the pattern).
