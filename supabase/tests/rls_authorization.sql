-- DealSure RLS authorization tests (positive + negative).
--
-- Run against a DEVELOPMENT database that has migrations applied and
-- supabase/seed.sql loaded (demo@dealsure.dev, admin@dealsure.dev fixtures):
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_authorization.sql
--
-- The whole script runs inside one transaction that ROLLS BACK at the end, so
-- fixture rows and the temporary "stranger" user never persist. Roles are
-- switched with SET ROLE; sessions are simulated via the request.jwt.claims
-- GUC (the claim auth.uid() reads under PostgREST). Fixture ids are handed to
-- DO blocks through session GUCs (psql does not interpolate variables inside
-- dollar-quoted bodies).
--
-- RLS semantics relied on below:
--   * SELECT / UPDATE: rows invisible under RLS are skipped silently
--     (assert via row counts / FOUND, not exceptions).
--   * INSERT: missing WITH CHECK policy raises a row-level-security error.
--   * Table grants revoked (migration 0007) raise insufficient_privilege.

\set ON_ERROR_STOP on
\pset pager off

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (run as the migration/superuser role)
-- ---------------------------------------------------------------------------
-- A third non-staff user: an unrelated authenticated user for negative tests.
insert into auth.users (id, email, email_confirmed_at, encrypted_password,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
values (gen_random_uuid(), 'stranger@dealsure.dev', now(), crypt('Stranger-dev-2026!', gen_salt('bf')),
        '{"provider": "email", "providers": ["email"]}', '{"full_name": "Stranger"}',
        now(), now(), 'authenticated', 'authenticated')
on conflict (email) do nothing;

-- A shareable (unaccepted) transaction owned by the seed seller.
insert into public.transactions
  (public_id, slug, status, seller_id, title, description, category,
   amount_minor, delivery_fee_minor, total_minor, currency, inspection_window_days)
select 'dex_test_0001', 'test-slug-aaaaaaaaaa', 'PENDING_BUYER_ACCEPTANCE',
       p.id, 'Test camera', 'A fine camera for the test.', 'Electronics',
       200000, 10000, 210000, 'NGN', 3
from public.profiles p
where p.email = 'demo@dealsure.dev';

-- A terminal (settled) transaction with a slug — invite RPC must NOT expose it.
insert into public.transactions
  (public_id, slug, status, seller_id, title, description, category,
   amount_minor, delivery_fee_minor, total_minor, currency, inspection_window_days)
select 'dex_test_0002', 'test-slug-settled-01', 'SETTLED',
       p.id, 'Sold phone', 'Already done.', 'Electronics',
       150000, 0, 150000, 'NGN', 3
from public.profiles p
where p.email = 'demo@dealsure.dev';

select t.id as pending_id, t2.id as settled_id, p.id as demo_id
from public.transactions t
cross join public.transactions t2
cross join public.profiles p
where t.slug = 'test-slug-aaaaaaaaaa'
  and t2.slug = 'test-slug-settled-01'
  and p.email = 'demo@dealsure.dev' \gset

select set_config('test.pending_id', :'pending_id', false);
select set_config('test.demo_id', :'demo_id', false);

-- ---------------------------------------------------------------------------
-- 1. POSITIVE: seller sees own profile and own transactions
-- ---------------------------------------------------------------------------
select format('{"sub":"%s","role":"authenticated"}', id) as claims
from public.profiles where email = 'demo@dealsure.dev' \gset
select set_config('request.jwt.claims', :'claims', false);
set role authenticated;

do $$
declare v int;
begin
  select count(*) into v from public.profiles where id = auth.uid();
  if v <> 1 then raise exception 'FAIL: seller cannot read own profile'; end if;

  select count(*) into v from public.transactions where seller_id = auth.uid();
  if v < 2 then raise exception 'FAIL: seller cannot read own transactions (got %)', v; end if;

  -- status history + participants are readable (empty) without error
  perform count(*) from public.transaction_status_history
   where transaction_id = current_setting('test.pending_id', true)::uuid;
  perform count(*) from public.transaction_participants;
  raise notice 'PASS 1: seller positive checks';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 2. NEGATIVE: unrelated user reads nothing of the seller's transaction
-- ---------------------------------------------------------------------------
select format('{"sub":"%s","role":"authenticated"}', id) as claims
from public.profiles where email = 'stranger@dealsure.dev' \gset
select set_config('request.jwt.claims', :'claims', false);
set role authenticated;

do $$
declare v int;
begin
  select count(*) into v from public.transactions
   where id = current_setting('test.pending_id', true)::uuid;
  if v <> 0 then raise exception 'FAIL: stranger can read seller''s transaction'; end if;

  select count(*) into v from public.transactions;
  if v <> 0 then raise exception 'FAIL: stranger can enumerate transactions (got %)', v; end if;

  select count(*) into v from public.transaction_participants;
  if v <> 0 then raise exception 'FAIL: stranger can enumerate participants'; end if;

  -- invite-hole regression: status alone must NOT grant visibility
  select count(*) into v from public.transactions where status = 'PENDING_BUYER_ACCEPTANCE';
  if v <> 0 then raise exception 'FAIL: invite hole regressed — stranger sees unaccepted transactions'; end if;

  raise notice 'PASS 2: stranger read-denial checks';
end $$;

-- ---------------------------------------------------------------------------
-- 3. NEGATIVE: stranger cannot modify or impersonate the seller's deal
-- ---------------------------------------------------------------------------
do $$
declare v int;
begin
  -- UPDATEs matching no visible rows succeed silently with 0 rows affected
  update public.transactions set title = 'hijacked'
   where id = current_setting('test.pending_id', true)::uuid;
  if found then raise exception 'FAIL: stranger updated the seller''s transaction'; end if;

  -- cannot insert a transaction impersonating another seller (WITH CHECK fails)
  begin
    insert into public.transactions
      (public_id, slug, status, seller_id, title, description, category,
       amount_minor, delivery_fee_minor, total_minor, currency, inspection_window_days)
    values ('dex_hijack', 'hijack-slug-00001', 'DRAFT',
            current_setting('test.demo_id', true)::uuid,
            'Hijack', 'Not their deal.', 'Other', 5000, 0, 5000, 'NGN', 3);
    raise exception 'FAIL: stranger inserted a transaction as the demo seller';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- cannot assign staff roles (no INSERT policy)
  begin
    insert into public.user_roles (profile_id, role, granted_by)
    values (auth.uid(), 'super_admin', auth.uid());
    raise exception 'FAIL: stranger assigned super_admin to themselves';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- cannot create payment intents (no INSERT policy)
  begin
    insert into public.payment_intents
      (transaction_id, payer_id, provider, idempotency_key, amount_minor, currency)
    values (current_setting('test.pending_id', true)::uuid, auth.uid(),
            'mock', 'ik-1', 1000, 'NGN');
    raise exception 'FAIL: stranger created a payment intent';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- cannot reach the state machine (EXECUTE revoked from authenticated, 0007)
  begin
    perform internal.transition_transaction(
      current_setting('test.pending_id', true)::uuid, 'CANCELLED', null);
    raise exception 'FAIL: stranger called transition_transaction';
  exception when insufficient_privilege then
    raise notice 'PASS 3: stranger write-denial checks (transition denied: insufficient_privilege)';
  when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS 3: stranger write-denial checks (transition denied: %)', sqlerrm;
  end;

  -- audit log read comes back empty for non-staff (function filters by role)
  if exists (select 1 from internal.get_audit_log(50)) then
    raise exception 'FAIL: stranger read audit logs';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 4. ANONYMOUS: no table access; the invite RPC is the only door
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{}', false);
set role anon;

do $$
declare v int;
begin
  begin
    select count(*) into v from public.transactions;
    raise exception 'FAIL: anon could read transactions table';
  exception when insufficient_privilege then
    raise notice 'anon blocked from transactions table (insufficient_privilege)';
  when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  begin
    select count(*) into v from public.profiles;
    raise exception 'FAIL: anon could read profiles';
  exception when insufficient_privilege then
    raise notice 'anon blocked from profiles (insufficient_privilege)';
  when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- positive invite: correct slug, pre-acceptance state
  select count(*) into v from public.get_transaction_by_slug('test-slug-aaaaaaaaaa');
  if v <> 1 then raise exception 'FAIL: anon invite lookup failed for valid slug'; end if;

  -- wrong slug
  select count(*) into v from public.get_transaction_by_slug('not-the-slug');
  if v <> 0 then raise exception 'FAIL: anon invite lookup matched wrong slug'; end if;

  -- terminal-state slug must not be exposed through the invite RPC
  select count(*) into v from public.get_transaction_by_slug('test-slug-settled-01');
  if v <> 0 then raise exception 'FAIL: invite RPC exposed a settled transaction'; end if;

  raise notice 'PASS 4: anonymous checks';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 5. OWN-ONLY: notifications visible only to their owner
-- ---------------------------------------------------------------------------
-- create one notification for demo as the table owner (no INSERT grant exists
-- for anon/authenticated by design — notifications are server-side only)
insert into public.notifications (profile_id, type, title)
select id, 'TEST', 'hello' from public.profiles where email = 'demo@dealsure.dev';

select format('{"sub":"%s","role":"authenticated"}', id) as claims
from public.profiles where email = 'demo@dealsure.dev' \gset
select set_config('request.jwt.claims', :'claims', false);
set role authenticated;

do $$
declare v int;
begin
  select count(*) into v from public.notifications;
  if v <> 1 then raise exception 'FAIL: owner notification visibility mismatch (%)', v; end if;

  -- owner can mark read but not rewrite the message (column grant, 0007)
  begin
    update public.notifications set title = 'tampered';
    raise exception 'FAIL: owner could rewrite notification content';
  exception when insufficient_privilege then
    raise notice 'PASS 5: notification content write denied (insufficient_privilege)';
  when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS 5: notification content write denied (%)', sqlerrm;
  end;

  update public.notifications set read_at = now();
  if not found then raise exception 'FAIL: owner could not mark notification read'; end if;
end $$;

reset role;

select format('{"sub":"%s","role":"authenticated"}', id) as claims
from public.profiles where email = 'stranger@dealsure.dev' \gset
select set_config('request.jwt.claims', :'claims', false);
set role authenticated;

do $$
begin
  if exists (select 1 from public.notifications) then
    raise exception 'FAIL: stranger sees someone else''s notifications';
  end if;
  raise notice 'PASS 5: notification isolation checks';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 6. STATE MACHINE (trusted path): valid transition works, invalid raises
-- ---------------------------------------------------------------------------
-- Runs as the migration runner role (a member of dealsure_owner via migration
-- 0001's self-grant), exercising the trusted write path the server layer uses.
do $$
begin
  perform internal.transition_transaction(
    current_setting('test.pending_id', true)::uuid, 'CANCELLED', null, 'test');

  begin
    perform internal.transition_transaction(
      current_setting('test.pending_id', true)::uuid, 'PAYMENT_SECURED', null, 'cheat');
    raise exception 'FAIL: invalid transition CANCELLED -> PAYMENT_SECURED was allowed';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'invalid transition rejected: %', sqlerrm;
  end;

  if not exists (
    select 1 from public.transaction_status_history
    where transaction_id = current_setting('test.pending_id', true)::uuid
      and to_status = 'CANCELLED'
  ) then raise exception 'FAIL: status history row missing'; end if;

  if not exists (
    select 1 from internal.audit_logs
    where entity_type = 'transaction'
      and entity_id = current_setting('test.pending_id', true)::uuid
      and action = 'STATUS_CHANGE'
  ) then raise exception 'FAIL: audit row missing'; end if;

  raise notice 'PASS 6: state machine checks';
end $$;

-- ---------------------------------------------------------------------------
-- 7. STAFF: admin fixture reads through staff policies
-- ---------------------------------------------------------------------------
select format('{"sub":"%s","role":"authenticated"}', id) as claims
from public.profiles where email = 'admin@dealsure.dev' \gset
select set_config('request.jwt.claims', :'claims', false);
set role authenticated;

do $$
begin
  if not exists (
    select 1 from public.transactions
    where id = current_setting('test.pending_id', true)::uuid
  ) then raise exception 'FAIL: staff cannot read transaction'; end if;

  if not exists (select 1 from public.profiles where email = 'stranger@dealsure.dev') then
    raise exception 'FAIL: staff cannot read profile';
  end if;

  if not exists (select 1 from internal.get_audit_log(50)) then
    raise exception 'FAIL: staff audit read empty despite audit rows existing';
  end if;

  raise notice 'PASS 7: staff checks';
end $$;

reset role;

-- all assertions passed
\echo 'RLS authorization tests PASSED'

rollback;
