-- DealSure bootstrap: extensions, schemas, owner role, audit infrastructure.
-- Idempotent-friendly bootstrap for a fresh local Supabase (and, later, staging).

-- Extensions
create extension if not exists pgcrypto;

-- Schemas
-- public is default; add internal (server-only financial/audit data).
create schema if not exists internal;

-- Dedicated owner for the trusted layer. Owns internal schema objects and the
-- SECURITY DEFINER functions so they can write server-only tables and bypass
-- RLS (table owners bypass RLS unless FORCE ROW LEVEL SECURITY is set).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'dealsure_owner') then
    create role dealsure_owner nologin;
  end if;
end
$$;

-- On hosted Supabase the migration runner (postgres) is NOT a superuser
-- (https://supabase.com/docs/guides/database/postgres/roles-superuser), so
-- `ALTER ... OWNER TO dealsure_owner` would fail with 42501. PostgreSQL lets a
-- role's CREATOR administer it, and this migration creates dealsure_owner, so
-- postgres can grant itself membership here; membership satisfies the
-- has_privs_of_role check that ALTER ... OWNER TO requires. This grant is a
-- hosted requirement, not a Docker workaround — the local dev image simply
-- mirrors the platform's non-superuser postgres. See
-- docs/architecture/database-ownership-decision.md.
grant dealsure_owner to postgres;

alter schema internal owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.audit_logs — append-only, server-only trail
-- ---------------------------------------------------------------------------
create table if not exists internal.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  actor_id uuid,                     -- profiles.id, null = system
  action text not null,
  from_status text,
  to_status text,
  reason text,
  meta jsonb,
  at timestamptz not null default now()
);

create index if not exists audit_logs_by_entity on internal.audit_logs (entity_type, entity_id, at desc);
create index if not exists audit_logs_by_actor on internal.audit_logs (actor_id, at desc);
create index if not exists audit_logs_by_action on internal.audit_logs (action, at desc);
create index if not exists audit_logs_by_at on internal.audit_logs (at desc);

alter table internal.audit_logs owner to dealsure_owner;

-- No UPDATE/DELETE ever. Enforce append-only at the grant level AND with a
-- defensive trigger that blocks destructive changes on this table.
create or replace function internal.audit_logs_append_only()
returns trigger language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'audit_logs is append-only';
  end if;
  return new;
end;
$$;

-- TRUNCATE only fires statement-level triggers, so it needs a separate one.
create or replace function internal.audit_logs_no_truncate()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

drop trigger if exists trg_audit_logs_append_only on internal.audit_logs;
create trigger trg_audit_logs_append_only
  before insert or update or delete on internal.audit_logs
  for each row execute function internal.audit_logs_append_only();

drop trigger if exists trg_audit_logs_no_truncate on internal.audit_logs;
create trigger trg_audit_logs_no_truncate
  before truncate on internal.audit_logs
  for each statement execute function internal.audit_logs_no_truncate();

alter function internal.audit_logs_append_only() owner to dealsure_owner;
alter function internal.audit_logs_no_truncate() owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.append_audit — the only sanctioned audit writer (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function internal.append_audit(
  p_entity_type text,
  p_entity_id uuid,
  p_actor_id uuid,
  p_action text,
  p_from_status text default null,
  p_to_status text default null,
  p_reason text default null,
  p_meta jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = internal, public
as $$
declare v_id uuid;
begin
  insert into internal.audit_logs (entity_type, entity_id, actor_id, action, from_status, to_status, reason, meta)
  values (p_entity_type, p_entity_id, p_actor_id, p_action, p_from_status, p_to_status, p_reason, p_meta)
  returning id into v_id;
  return v_id;
end;
$$;

alter function internal.append_audit(text, uuid, uuid, text, text, text, text, jsonb) owner to dealsure_owner;

-- PostgREST/API roles can call append_audit? No — writes stay server-only
-- (Edge Functions use the service role). Nothing granted here.

-- ---------------------------------------------------------------------------
-- Grants baseline
-- ---------------------------------------------------------------------------
-- internal schema is intentionally NOT granted table access to
-- anon/authenticated, so its data is invisible to the Data API (PostgREST only
-- exposes schemas listed in the API config, and no table/sequence grants exist
-- here).
--
-- USAGE is granted so RLS policies and API roles can CALL the SECURITY DEFINER
-- helper functions that live in internal (has_role_any, can_view_transaction,
-- get_audit_log). USAGE alone exposes object names, never data. All function
-- EXECUTE grants are selective and are tightened further in migration 0007
-- (functions default to EXECUTE for PUBLIC, which is revoked there).
revoke all on schema internal from anon, authenticated;
grant usage on schema internal to anon, authenticated;