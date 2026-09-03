-- DealSure security hardening pass (review of migrations 0001-0006).
--
-- Three defects found in review are corrected here (plus defense-in-depth):
--
--   1. PostgreSQL grants EXECUTE to PUBLIC on every function by default. With
--      schema USAGE on `internal` granted to anon/authenticated (0001), the
--      SECURITY DEFINER functions in `internal` (transition_transaction,
--      post_double_entry, issue_delivery_otp, append_audit, ...) would be
--      callable by any API role — privilege escalation. Default PUBLIC
--      execute is revoked from every function; the minimal surface is
--      re-granted explicitly below.
--
--   2. Table grants: `anon` is revoked from every public application table.
--      Only public legal text (terms_versions SELECT) and the invite RPC
--      (get_transaction_by_slug) remain reachable anonymously.
--
--   3. Column scoping for the two self-service UPDATE surfaces so users can
--      never mutate privileged columns of their own rows (profiles.status,
--      notifications.type/title/body/...).
--
-- Server-side financial writes (service_role) are deliberately NOT granted
-- table access here: the internal-schema write path arrives with the
-- financial-slice migration as public wrapper RPCs (granted to service_role
-- only) or via a trusted direct connection. Nothing in `internal` is
-- reachable through the Data API.

-- ---------------------------------------------------------------------------
-- 1. Function EXECUTE surface
-- ---------------------------------------------------------------------------
-- internal schema — remove default PUBLIC execute from everything, and drop
-- the earlier explicit anon grants on the role helpers (0002) so anon's
-- surface is exactly: get_transaction_by_slug + terms_versions SELECT.
revoke all on all functions in schema internal from public;
revoke all on function
  internal.has_role_any(text[]),
  internal.has_role(text),
  internal.is_staff()
from anon;

-- Keep the read/role-check helpers callable by RLS policies and API reads
-- (authenticated only).
grant execute on function
  internal.has_role_any(text[]),
  internal.has_role(text),
  internal.is_staff(),
  internal.can_view_transaction(uuid),
  internal.get_audit_log(int, text, uuid)
to authenticated;

-- Remaining internal functions (append_audit, transition_transaction,
-- issue_delivery_otp, verify_delivery_otp, post_double_entry,
-- assert_ledger_balance, refunds_before_insert, append-only guards) are not
-- granted to anon/authenticated/service_role at this layer. They execute only
-- as their owner (dealsure_owner) from triggers/other SECURITY DEFINER
-- functions and — once the financial slice lands — from public wrapper RPCs.

-- public schema — remove default PUBLIC execute from app functions.
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.assign_default_roles() from public;
revoke all on function public.get_my_roles() from public;
revoke all on function public.disputes_after_insert() from public;
revoke all on function public.get_transaction_by_slug(text) from public;

-- Trigger-only helpers need no API execute grant (triggers run as the table
-- owner, not the caller). Re-grant the read surface:
grant execute on function public.get_my_roles() to authenticated;
grant execute on function public.get_transaction_by_slug(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Anonymous table grants — nothing but the public terms text
-- ---------------------------------------------------------------------------
revoke all on table
  public.profiles,
  public.user_roles,
  public.terms_acceptances,
  public.kyc_profiles,
  public.bank_accounts,
  public.transactions,
  public.transaction_items,
  public.transaction_media,
  public.transaction_status_history,
  public.transaction_participants,
  public.deliveries,
  public.delivery_events,
  public.disputes,
  public.dispute_messages,
  public.dispute_evidence,
  public.notifications,
  public.payment_intents
from anon;

grant select on table public.terms_versions to anon;

-- ---------------------------------------------------------------------------
-- 3. Column-scoped self-service updates (defense-in-depth over RLS)
-- ---------------------------------------------------------------------------
-- profiles: users may maintain public contact/display fields only. status,
-- auth_subject, email (auth-owned), public_id uniqueness rules and timestamps
-- stay server/auth-controlled. RLS policy profiles_update_own already limits
-- rows to the caller; grants now limit columns.
revoke update on table public.profiles from anon, authenticated;
grant update (display_name, full_name, phone, country, onboarded)
  on table public.profiles to authenticated;

-- notifications: users may mark their own notifications read — nothing else.
revoke update on table public.notifications from anon, authenticated;
grant update (read_at) on table public.notifications to authenticated;
