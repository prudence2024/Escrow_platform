-- DealSure: re-assert auth-schema access for the trusted role (follow-up to 0008).
--
-- Verification against the hosted development database found that the grants
-- issued in migration 0008 were absent from the remote auth-schema ACL
-- (auth.nspacl carried no dealsure_owner entry and auth.uid()/auth.role()
-- proacl carried no explicit dealsure_owner entry). As a result the
-- SECURITY DEFINER helpers owned by dealsure_owner
-- (internal.has_role_any/has_role/is_staff, internal.can_view_transaction)
-- failed with `42501 permission denied for schema auth` when resolving
-- auth.uid(), which broke RLS-dependent reads.
--
-- Migrations 0001-0008 are frozen remote history and are NOT modified here.
-- The three grants below are idempotent: re-running them when the privileges
-- already exist is a no-op success.
--
-- Scope (unchanged from 0008): USAGE on schema auth + EXECUTE on the
-- auth.uid() and auth.role() helpers only. No access to auth tables
-- (auth.users etc. stay untouched for this role), no ownership of
-- Supabase-managed auth objects, no changes to Supabase Auth behavior.

grant usage on schema auth to dealsure_owner;

grant execute on function auth.uid() to dealsure_owner;
grant execute on function auth.role() to dealsure_owner;
