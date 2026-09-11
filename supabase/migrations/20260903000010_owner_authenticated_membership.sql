-- DealSure: make auth.uid() resolvable for the trusted role via membership.
--
-- FINDING (verified on the hosted development database): the direct grants in
-- 0008/0009 (`GRANT USAGE ON SCHEMA auth`, `GRANT EXECUTE ON FUNCTION
-- auth.uid()/auth.role()`) report success but leave no trace in the remote
-- auth-schema ACL (auth.nspacl / proacl unchanged across separate sessions),
-- while ordinary writes through the same connection persist. The hosted
-- platform does not retain custom grants on the Supabase-managed auth schema,
-- so the SECURITY DEFINER helpers owned by dealsure_owner kept failing with
-- `42501 permission denied for schema auth` when resolving auth.uid().
-- Migrations 0001-0009 are frozen remote history and are NOT modified here.
--
-- FIX: grant membership in the platform-managed `authenticated` role to the
-- NOLOGIN `dealsure_owner` role. Effect, verified before/after:
--   + USAGE on schema auth (inherited; the only new effective capability)
--   + EXECUTE on auth.uid()/auth.role() (already PUBLIC; unchanged)
--   + NO table privileges on auth.users (authenticated holds none: no
--     SELECT/INSERT/UPDATE/DELETE is inherited)
--   + NO ownership of any Supabase-managed auth object
--   + NO change to Supabase Auth behavior
-- The direct grants are repeated below so fresh self-hosted/local rebuilds
-- (where the runner retains them) keep the narrow explicit form; on hosted
-- they are harmless no-ops and membership carries the effective privilege.
-- The statement is idempotent: re-running it when membership already exists
-- succeeds without error.

grant authenticated to dealsure_owner;

grant usage on schema auth to dealsure_owner;

grant execute on function auth.uid() to dealsure_owner;
grant execute on function auth.role() to dealsure_owner;
