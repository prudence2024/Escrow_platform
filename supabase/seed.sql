-- DealSure development seed. RUNS ONLY IN LOCAL/STAGING — never production.
-- Credentials below are DEV-ONLY fixtures for local testing:
--   demo@dealsure.dev / DealSure-dev-2026!   (buyer + seller)
--   admin@dealsure.dev  / DealSure-dev-2026!   (super_admin, operations_admin, finance_admin)
-- Delete this file (or empty it) before any production deploy.

-- Terms version 1 (mirrors the version accepted by the current Convex flow).
insert into public.terms_versions (version, content, effective_at)
values (1, 'DealSure protected-transaction terms (development placeholder — replace with reviewed legal terms).', now())
on conflict (version) do nothing;

-- Dev auth users (password hashed with pgcrypto; bcrypt).
-- auth.users.email has a non-unique INDEX on hosted Supabase (no unique
-- constraint), so ON CONFLICT (email) is unavailable; NOT EXISTS guards keep
-- the seed idempotent instead.
insert into auth.users (id, email, email_confirmed_at, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
select gen_random_uuid(), 'demo@dealsure.dev', now(), crypt('DealSure-dev-2026!', gen_salt('bf')),
       '{"provider": "email", "providers": ["email"]}', '{"full_name": "Demo User"}', now(), now(), 'authenticated', 'authenticated'
where not exists (select 1 from auth.users where email = 'demo@dealsure.dev');

insert into auth.users (id, email, email_confirmed_at, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
select gen_random_uuid(), 'admin@dealsure.dev', now(), crypt('DealSure-dev-2026!', gen_salt('bf')),
       '{"provider": "email", "providers": ["email"]}', '{"full_name": "Admin User"}', now(), now(), 'authenticated', 'authenticated'
where not exists (select 1 from auth.users where email = 'admin@dealsure.dev');

-- Elevate the admin fixture to staff roles (profiles/roles are created by the
-- auth-user trigger; grant staff roles on top).
update public.user_roles ur
set granted_at = now()
from public.profiles p
where p.email = 'admin@dealsure.dev' and ur.profile_id = p.id
  and ur.role in ('buyer', 'seller');

insert into public.user_roles (profile_id, role, granted_by)
select p.id, r.role, p.id
from public.profiles p
cross join (values ('super_admin'), ('operations_admin'), ('finance_admin'), ('dispute_agent'), ('support_agent')) as r(role)
where p.email = 'admin@dealsure.dev'
on conflict (profile_id, role) do nothing;

-- Ledger chart of accounts is seeded in migration 0006 (kept there so a
-- rebuild-from-migrations alone — without seed — still has the chart).