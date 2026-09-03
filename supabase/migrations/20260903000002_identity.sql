-- DealSure identity: profiles, user_roles, terms_*, kyc_profiles, bank_accounts.
-- RLS-first: every table has explicit policies; no blanket USING(true).

-- ---------------------------------------------------------------------------
-- public.profiles — profiles.id = auth.users.id (approved decision #2)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  auth_provider text not null default 'supabase',
  auth_subject text,
  public_id text unique,               -- user-facing reference, not an identity layer
  display_name text,
  full_name text,
  phone text,
  country text,
  email text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISABLED', 'SUSPENDED')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email)) where email is not null;

create index if not exists profiles_by_phone on public.profiles (phone);

alter table public.profiles owner to dealsure_owner;

-- Auto-create a profile when an auth user signs up (also covers anonymous).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, auth_provider, auth_subject, email, display_name, full_name)
  values (
    new.id,
    coalesce(new.raw_app_meta_data ->> 'provider', 'supabase'),
    new.id::text,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter function public.handle_new_auth_user() owner to dealsure_owner;

-- RLS: users see and update their own profile; staff can read for support.
alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_staff on public.profiles
  for select using (internal.has_role_any(ARRAY['support_agent', 'dispute_agent', 'operations_admin', 'finance_admin', 'super_admin']));

-- Updates only on safe, self-managed columns (least privilege).
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- public.user_roles — database-backed authorization (approved decision #12)
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in (
    'buyer', 'seller', 'merchant',
    'support_agent', 'dispute_agent', 'operations_admin', 'finance_admin', 'super_admin'
  )),
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (profile_id, role)
);

create index user_roles_by_profile on public.user_roles (profile_id);

alter table public.user_roles owner to dealsure_owner;

alter table public.user_roles enable row level security;

-- No direct user access to user_roles. Roles are read through
-- internal.has_role_any() / get_my_roles() and staff queries below.
create policy user_roles_select_staff on public.user_roles
  for select using (internal.has_role_any(ARRAY['operations_admin', 'finance_admin', 'super_admin']));

-- Every profile starts as buyer + seller (a person may be both).
create or replace function public.assign_default_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (profile_id, role, granted_by)
  values (new.id, 'buyer', new.id), (new.id, 'seller', new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_profiles_default_roles on public.profiles;
create trigger trg_profiles_default_roles
  after insert on public.profiles
  for each row execute function public.assign_default_roles();

alter function public.assign_default_roles() owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.has_role_any / internal.has_role / internal.is_staff —
-- role checks used by RLS policies and trusted functions (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function internal.has_role_any(p_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role = any (p_roles)
      and ur.revoked_at is null
  );
$$;

create or replace function internal.has_role(p_role text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select internal.has_role_any(ARRAY[p_role]);
$$;

create or replace function internal.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select internal.has_role_any(ARRAY['support_agent', 'dispute_agent', 'operations_admin', 'finance_admin', 'super_admin']);
$$;

alter function internal.has_role_any(text[]) owner to dealsure_owner;
alter function internal.has_role(text) owner to dealsure_owner;
alter function internal.is_staff() owner to dealsure_owner;

grant execute on function internal.has_role_any(text[]) to anon, authenticated;
grant execute on function internal.has_role(text) to anon, authenticated;
grant execute on function internal.is_staff() to anon, authenticated;

-- Own roles for the current user (used by the frontend to drive UI).
create or replace function public.get_my_roles()
returns table (role text)
language sql
security definer
stable
set search_path = public
as $$
  select ur.role
  from public.user_roles ur
  where ur.profile_id = auth.uid() and ur.revoked_at is null;
$$;

alter function public.get_my_roles() owner to dealsure_owner;
grant execute on function public.get_my_roles() to authenticated;

-- ---------------------------------------------------------------------------
-- public.terms_versions / public.terms_acceptances
-- ---------------------------------------------------------------------------
create table public.terms_versions (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  content text not null,
  effective_at timestamptz not null
);

alter table public.terms_versions owner to dealsure_owner;
alter table public.terms_versions enable row level security;

create policy terms_versions_select_all on public.terms_versions
  for select using (true); -- public, non-sensitive legal text; documented reason

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version int not null references public.terms_versions (version),
  accepted_at timestamptz not null default now(),
  unique (profile_id, version)
);

alter table public.terms_acceptances owner to dealsure_owner;
alter table public.terms_acceptances enable row level security;

create policy terms_acceptances_select_own on public.terms_acceptances
  for select using (profile_id = auth.uid());

create policy terms_acceptances_insert_own on public.terms_acceptances
  for insert with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- public.kyc_profiles
-- ---------------------------------------------------------------------------
create table public.kyc_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade unique,
  status text not null default 'UNVERIFIED' check (status in ('UNVERIFIED', 'SUBMITTED', 'VERIFIED', 'REJECTED')),
  doc_type text,
  verified_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kyc_profiles owner to dealsure_owner;
alter table public.kyc_profiles enable row level security;

create policy kyc_select_own on public.kyc_profiles
  for select using (profile_id = auth.uid());

create policy kyc_select_staff on public.kyc_profiles
  for select using (internal.has_role_any(ARRAY['support_agent', 'dispute_agent', 'operations_admin', 'finance_admin', 'super_admin']));

-- Submission is user-initiated but fixed to SUBMITTED; approval is staff-only
-- (no user UPDATE grant at all).
create policy kyc_insert_own_submitted on public.kyc_profiles
  for insert with check (profile_id = auth.uid() and status = 'SUBMITTED');

-- ---------------------------------------------------------------------------
-- public.bank_accounts (payout accounts)
-- ---------------------------------------------------------------------------
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider text,
  account_name text not null,
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  bank_name text not null,
  bank_code text,
  status text not null default 'PENDING' check (status in ('PENDING', 'VERIFIED', 'REJECTED')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, account_number)
);

alter table public.bank_accounts owner to dealsure_owner;
alter table public.bank_accounts enable row level security;

create policy bank_accounts_select_own on public.bank_accounts
  for select using (profile_id = auth.uid());

create policy bank_accounts_select_staff on public.bank_accounts
  for select using (internal.is_staff());

create policy bank_accounts_insert_own on public.bank_accounts
  for insert with check (profile_id = auth.uid());

-- Status verification is server-only: no user UPDATE grant.