-- DealSure: auth-schema access for the trusted role.
--
-- internal.has_role_any/has_role/is_staff (migration 0002) and
-- internal.can_view_transaction (0003) are SECURITY DEFINER functions owned by
-- dealsure_owner. They call auth.uid() to resolve the caller's identity. Under
-- SECURITY DEFINER the function runs as dealsure_owner, so THAT role needs
-- USAGE on schema auth and EXECUTE on auth.uid() (the latter is PUBLIC by
-- default and untouched). Custom roles do not receive the default auth-schema
-- grants Supabase gives its own roles, so the USAGE must be explicit.
--
-- Scope: USAGE on schema auth + execute on auth.uid() and auth.role() only —
-- no access to auth tables (auth.users etc. stay untouched for this role).
-- Revoking PUBLIC execute on these helpers is deliberately NOT done: other
-- Supabase roles rely on the platform default for them.

grant usage on schema auth to dealsure_owner;

grant execute on function auth.uid() to dealsure_owner;
grant execute on function auth.role() to dealsure_owner;
