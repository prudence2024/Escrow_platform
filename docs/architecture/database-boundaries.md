# DealSure — Database Boundaries

How the target PostgreSQL database is split, what each schema exposes, and
what the browser may touch. Mirrors the Convex security model (function-level
checks) as RLS + grants so a direct Data-API call cannot bypass it.

## Schema layout

### `public` — app data exposed through the Data API (with RLS)

Tables the browser legitimately reads (and narrowly writes) under RLS:

| Table | Browser access |
| --- | --- |
| `profiles` | SELECT own; UPDATE own (non-sensitive fields via narrow policy) |
| `user_roles` | no direct access; own roles via `get_my_roles()` SECURITY DEFINER |
| `terms_versions` | SELECT (public terms) |
| `terms_acceptances` | SELECT own; INSERT own |
| `transactions` | SELECT participant/staff; INSERT seller (create flow); **no direct status UPDATE** (transition function only) |
| `transaction_items` | SELECT with tx visibility; INSERT seller (create flow) |
| `transaction_media` | SELECT with tx visibility; INSERT seller (create flow) |
| `transaction_status_history` | SELECT with tx visibility; **INSERT server-only** |
| `transaction_participants` | SELECT with tx visibility; **INSERT server-only** |
| `payment_intents` | SELECT payer/participant/staff; **INSERT/UPDATE server-only** |
| `deliveries` / `delivery_events` | SELECT with tx visibility; **INSERT/UPDATE server-only** |
| `disputes` | SELECT participant/staff; INSERT participant; status UPDATE server-only |
| `dispute_messages` | SELECT participant/staff; INSERT participant/staff |
| `dispute_evidence` | SELECT participant/staff; INSERT participant/staff |
| `notifications` | SELECT/UPDATE own (mark read); **INSERT server-only** |

### `internal` — NOT exposed to PostgREST; server-only

Supabase's Data API only exposes the `public` schema. Everything here is
invisible to the browser and only reachable through SECURITY DEFINER
functions or Edge Functions with the service role:

| Table | Why server-only |
| --- | --- |
| `payment_events` | provider event records; browser must never create |
| `provider_webhook_events` | webhook dedup/replay protection |
| `ledger_accounts` / `ledger_transactions` / `ledger_entries` | append-only double-entry |
| `settlements` / `refunds` | money movement |
| `delivery_otps` | hashed codes + attempt counters |
| `audit_logs` | immutable trail |
| `risk_flags` / `admin_notes` | ops-only |
| `migration_identity_map` / `migration_record_map` | migration tooling |

Reads of internal data happen through narrow SECURITY DEFINER functions
(e.g. `internal.get_audit_log(...)` staff-only, `internal.get_ledger(...)`
finance_admin-only) or Edge Functions.

## Grants policy (least privilege)

- `anon` / `authenticated` roles: `GRANT` only what RLS allows on `public`.
- **No grants at all on `internal` to `anon`/`authenticated`.**
- `service_role`: full access, but only ever used inside Edge Functions
  (never shipped to the browser, never in `NEXT_PUBLIC_`/`VITE_` variables,
  never in Git).
- SECURITY DEFINER functions run as the owner (e.g. `dealsure_owner`) and
  are the only path into `internal` writes.

## RLS policy pattern

Every `public` table has explicit policies — no `USING (true)` without a
documented reason:

1. **Visibility helper** — `internal.can_view_transaction(tx_id uuid)`
   (SECURITY DEFINER, returns `auth.uid()` is seller/buyer/participant/staff
   or pre-acceptance slug holder) reused by `transactions`,
   `transaction_items`, `transaction_media`, `transaction_status_history`,
   `transaction_participants`, `deliveries`, `delivery_events`, `disputes`,
   `dispute_messages`, `dispute_evidence`, `payment_intents` (read).
2. **Own-row policies** — `profiles`, `notifications`, `terms_acceptances`,
   `kyc_profiles`, `bank_accounts`.
3. **Staff policies** — explicit role checks (`has_role('operations_admin')`
   etc.), never email/frontend checks.
4. **Insert policies** — narrow `WITH CHECK` (e.g. seller creating their own
   transaction) or no insert grant at all where the flow is server-only.

## Negative tests the RLS suite must prove

From the brief (mapped to concrete policy assertions):

1. Buyer A cannot read Buyer B's private transaction (SELECT policy test).
2. Seller A cannot UPDATE Seller B's transaction (no broad UPDATE grant).
3. A stranger cannot enumerate `transaction_participants` (visibility
   helper + no table-level SELECT for non-participants).
4. Buyer cannot INSERT `payment_events` (internal schema, no grant).
5. Seller cannot mark payment successful (no grant on `payment_intents.status`;
   only `internal.verify_payment` may).
6. Buyer cannot create a `settlement` (internal schema).
7. Seller cannot create a `refund` (internal schema).
8. Normal user cannot SELECT `audit_logs` (internal schema; staff function only).
9. Normal user cannot grant roles (`grant_role` is super_admin-only function;
   no insert grant on `user_roles`).
10. A dispute_agent cannot promote themselves (role-grant function checks the
    *actor's* role server-side, and RLS offers no direct write on `user_roles`).
11. A support_agent cannot perform finance-admin actions (per-function role
    checks: refunds/settlements require `finance_admin`/`super_admin`).
12. Anonymous users cannot enumerate protected records (RLS on `auth.uid()`
    returns null for anon → no rows).

These become an automated test suite (SQL + integration) in Phase 5 and are
re-run after every sensitive phase.

## Storage boundaries

Supabase Storage buckets are private (no public read policy):

- `transaction-evidence` — seller media
- `delivery-evidence` — delivery proof
- `dispute-evidence` — dispute attachments
- `kyc-documents` — KYC uploads (staff read only)

Access via signed URLs generated server-side; upload via Edge Function with
size/MIME/extension validation and UUID rename. Storage object RLS mirrors
the table policies (participant/staff reads; no anonymous reads).

## Realtime boundary

Realtime (`postgres_changes`) enabled only on: `transactions` (status),
`deliveries`, `delivery_events`, `dispute_messages`, `notifications` —
and the RLS policies governing those tables also govern what a Realtime
subscriber receives (RLS applies to Realtime in Supabase). No Realtime on
internal tables (they are not exposed).