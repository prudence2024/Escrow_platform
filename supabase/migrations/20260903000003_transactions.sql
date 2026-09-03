-- DealSure transactions domain: transactions, items, media, participants,
-- status history, the trusted transition machine, and RLS.

-- ---------------------------------------------------------------------------
-- internal.can_view_transaction — visibility helper reused by many policies
-- (mirrors Convex canViewTransaction; also reproduced in transaction reads)
--
-- NOTE: pre-acceptance invite visibility is deliberately NOT included here.
-- Policies keyed on transaction id cannot prove slug possession, so adding a
-- "status = PENDING_BUYER_ACCEPTANCE" clause here would let ANY authenticated
-- user enumerate every unaccepted transaction. Invite access goes through
-- public.get_transaction_by_slug() instead, where the slug itself is the
-- credential (96-bit unguessable, mirrors Convex).
-- ---------------------------------------------------------------------------
create or replace function internal.can_view_transaction(p_transaction_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, internal
as $$
  select exists (
    select 1
    from public.transactions t
    where t.id = p_transaction_id
      and (
        t.seller_id = auth.uid()
        or t.buyer_id = auth.uid()
        or exists (
          select 1 from public.transaction_participants tp
          where tp.transaction_id = t.id and tp.profile_id = auth.uid()
        )
        or internal.is_staff()
      )
  );
$$;

alter function internal.can_view_transaction(uuid) owner to dealsure_owner;
-- Grant only to authenticated: anon visibility is handled exclusively by
-- public.get_transaction_by_slug() (migration 0003). RLS policies on tables
-- anon cannot SELECT never evaluate this function for anon.
grant execute on function internal.can_view_transaction(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- public.transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,               -- dex_… human reference
  slug text not null unique,                    -- unguessable share token
  status text not null check (status in (
    'DRAFT', 'PENDING_BUYER_ACCEPTANCE', 'AWAITING_PAYMENT', 'PAYMENT_PROCESSING',
    'PAYMENT_SECURED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'DELIVERED_PENDING_INSPECTION',
    'ACCEPTED', 'RELEASE_PENDING', 'SETTLED', 'DISPUTED', 'REFUND_PENDING',
    'REFUNDED', 'CANCELLED', 'EXPIRED'
  )),

  -- participants
  seller_id uuid not null references public.profiles (id),
  buyer_id uuid references public.profiles (id),
  buyer_email text,
  buyer_phone text,

  -- listing
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) <= 4000),
  category text not null check (category in (
    'Electronics', 'Fashion', 'Home & Living', 'Automotive', 'Services',
    'Agriculture', 'Food & Groceries', 'Creative', 'Other'
  )),
  condition text,

  -- money (integer minor units, NGN kobo) — no floats
  amount_minor bigint not null check (amount_minor >= 0),
  delivery_fee_minor bigint not null check (delivery_fee_minor >= 0),
  total_minor bigint not null check (total_minor = amount_minor + delivery_fee_minor),
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  fee_charged_to text check (fee_charged_to in ('buyer', 'seller', 'split')),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),

  -- terms
  agreed_deadline_at timestamptz,
  inspection_window_days int not null default 3 check (inspection_window_days between 1 and 30),
  return_terms text,

  -- ops flags
  dispute_blocked boolean not null default false,
  released_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- public.get_transaction_by_slug — secure invite lookup (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
-- A share link is /t/<slug>; the slug is the unguessable capability that lets
-- a visitor (authenticated OR anonymous) preview the deal before accepting.
-- RLS cannot express "viewable if you hold the slug" on a normal SELECT, so
-- invite access goes through this narrow function instead. It returns a fixed
-- column list (no buyer contact details, no internal fields) and only for
-- pre-acceptance states. Consequential actions (accept, pay, dispute) always
-- require an authenticated session and are handled by other paths.
create or replace function public.get_transaction_by_slug(p_slug text)
returns table (
  id uuid,
  public_id text,
  status text,
  title text,
  description text,
  category text,
  condition text,
  amount_minor bigint,
  delivery_fee_minor bigint,
  total_minor bigint,
  fee_minor bigint,
  fee_charged_to text,
  currency character(3),
  inspection_window_days int,
  return_terms text,
  agreed_deadline_at timestamptz,
  seller_id uuid,
  seller_display_name text,
  seller_created_at timestamptz
)
language sql
security definer
stable
set search_path = public, internal
as $$
  select t.id, t.public_id, t.status, t.title, t.description, t.category,
         t.condition, t.amount_minor, t.delivery_fee_minor, t.total_minor,
         t.fee_minor, t.fee_charged_to, t.currency, t.inspection_window_days,
         t.return_terms, t.agreed_deadline_at, t.seller_id,
         p.display_name as seller_display_name,
         p.created_at as seller_created_at
  from public.transactions t
  left join public.profiles p on p.id = t.seller_id
  where t.slug = p_slug
    and t.status in ('PENDING_BUYER_ACCEPTANCE', 'AWAITING_PAYMENT')
    and t.seller_id is not null
  limit 1;
$$;

alter function public.get_transaction_by_slug(text) owner to dealsure_owner;
-- Explicit grants: PUBLIC default execute is revoked in migration 0007; anon
-- needs this to open an invite link without signing in.
grant execute on function public.get_transaction_by_slug(text) to anon, authenticated;

-- limits from config.ts (₦50.00 – ₦10,000,000.00 in kobo)
alter table public.transactions
  add constraint transactions_amount_range check (amount_minor between 5000 and 1000000000);

create index transactions_by_seller on public.transactions (seller_id, created_at desc);
create index transactions_by_buyer on public.transactions (buyer_id, created_at desc);
create index transactions_by_status on public.transactions (status, created_at desc);
create index transactions_by_created on public.transactions (created_at desc);

alter table public.transactions owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.allowed_transitions — explicit transition map (DB mirror of
-- src/convex/transactions/state.ts)
-- ---------------------------------------------------------------------------
create table internal.allowed_transitions (
  from_status text not null,
  to_status text not null,
  primary key (from_status, to_status)
);

insert into internal.allowed_transitions (from_status, to_status) values
  ('DRAFT', 'PENDING_BUYER_ACCEPTANCE'), ('DRAFT', 'CANCELLED'),
  ('PENDING_BUYER_ACCEPTANCE', 'AWAITING_PAYMENT'), ('PENDING_BUYER_ACCEPTANCE', 'CANCELLED'), ('PENDING_BUYER_ACCEPTANCE', 'EXPIRED'),
  ('AWAITING_PAYMENT', 'PAYMENT_PROCESSING'), ('AWAITING_PAYMENT', 'CANCELLED'), ('AWAITING_PAYMENT', 'EXPIRED'),
  ('PAYMENT_PROCESSING', 'PAYMENT_SECURED'), ('PAYMENT_PROCESSING', 'CANCELLED'),
  ('PAYMENT_SECURED', 'READY_FOR_DELIVERY'), ('PAYMENT_SECURED', 'DISPATCHED'), ('PAYMENT_SECURED', 'DISPUTED'),
  ('READY_FOR_DELIVERY', 'DISPATCHED'), ('READY_FOR_DELIVERY', 'DISPUTED'),
  ('DISPATCHED', 'DELIVERED_PENDING_INSPECTION'), ('DISPATCHED', 'DISPUTED'),
  ('DELIVERED_PENDING_INSPECTION', 'ACCEPTED'), ('DELIVERED_PENDING_INSPECTION', 'DISPUTED'),
  ('ACCEPTED', 'RELEASE_PENDING'), ('ACCEPTED', 'DISPUTED'),
  ('RELEASE_PENDING', 'SETTLED'), ('RELEASE_PENDING', 'DISPUTED'), ('RELEASE_PENDING', 'REFUND_PENDING'),
  ('DISPUTED', 'RELEASE_PENDING'), ('DISPUTED', 'REFUND_PENDING'),
  ('REFUND_PENDING', 'REFUNDED');

alter table internal.allowed_transitions owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.transition_transaction — the ONLY sanctioned status writer
-- (SECURITY DEFINER). Locks the row, validates the transition, updates,
-- records status history and audit in one transaction.
-- ---------------------------------------------------------------------------
create table public.transaction_status_history (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  from_status text,
  to_status text not null,
  reason text,
  meta jsonb,
  at timestamptz not null default now()
);

create index transaction_status_history_by_tx on public.transaction_status_history (transaction_id, at desc);
alter table public.transaction_status_history owner to dealsure_owner;

create or replace function internal.transition_transaction(
  p_transaction_id uuid,
  p_to_status text,
  p_actor_id uuid default null,
  p_reason text default null,
  p_meta jsonb default null
)
returns text
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_from_status text;
begin
  -- Row lock: serializes concurrent transitions on the same transaction.
  select status into v_from_status
  from public.transactions
  where id = p_transaction_id
  for update;

  if v_from_status is null then
    raise exception 'Transaction not found';
  end if;

  if v_from_status = p_to_status then
    return v_from_status; -- idempotent no-op
  end if;

  if not exists (
    select 1 from internal.allowed_transitions
    where from_status = v_from_status and to_status = p_to_status
  ) then
    raise exception 'Invalid state transition: % -> %', v_from_status, p_to_status;
  end if;

  update public.transactions
     set status = p_to_status, updated_at = now()
   where id = p_transaction_id;

  insert into public.transaction_status_history (transaction_id, actor_id, from_status, to_status, reason, meta)
  values (p_transaction_id, p_actor_id, v_from_status, p_to_status, p_reason, p_meta);

  perform internal.append_audit(
    'transaction', p_transaction_id, p_actor_id, 'STATUS_CHANGE',
    v_from_status, p_to_status, p_reason, p_meta
  );

  return v_from_status;
end;
$$;

alter function internal.transition_transaction(uuid, text, uuid, text, jsonb) owner to dealsure_owner;

-- Status history is INSERT-only via the transition function: no client grants.

-- ---------------------------------------------------------------------------
-- public.transaction_items / public.transaction_media
-- ---------------------------------------------------------------------------
create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  name text not null,
  note text
);

create index transaction_items_by_tx on public.transaction_items (transaction_id);
alter table public.transaction_items owner to dealsure_owner;

create table public.transaction_media (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  storage_path text,                 -- Supabase Storage object path (private)
  url text,                          -- external reference (pre-migration)
  kind text not null default 'image',
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index transaction_media_by_tx on public.transaction_media (transaction_id);
alter table public.transaction_media owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- public.transaction_participants
-- ---------------------------------------------------------------------------
create table public.transaction_participants (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('buyer', 'seller')),
  email text,
  accepted_at timestamptz,
  unique (transaction_id, profile_id)
);

create index transaction_participants_by_tx on public.transaction_participants (transaction_id);
create index transaction_participants_by_profile on public.transaction_participants (profile_id, transaction_id);
alter table public.transaction_participants owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- RLS for the transactions domain
-- ---------------------------------------------------------------------------
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.transaction_media enable row level security;
alter table public.transaction_status_history enable row level security;
alter table public.transaction_participants enable row level security;

-- SELECT — participant visibility (seller/buyer/participant/staff/invitee)
create policy transactions_select_visible on public.transactions
  for select using (internal.can_view_transaction(id));

create policy transaction_items_select_visible on public.transaction_items
  for select using (internal.can_view_transaction(transaction_id));

create policy transaction_media_select_visible on public.transaction_media
  for select using (internal.can_view_transaction(transaction_id));

create policy transaction_status_history_select_visible on public.transaction_status_history
  for select using (internal.can_view_transaction(transaction_id));

create policy transaction_participants_select_visible on public.transaction_participants
  for select using (internal.can_view_transaction(transaction_id));

-- INSERT — seller creating their own transaction (DRAFT) and its items/media
create policy transactions_insert_seller on public.transactions
  for insert with check (seller_id = auth.uid() and status = 'DRAFT');

create policy transaction_items_insert_seller_draft on public.transaction_items
  for insert with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.seller_id = auth.uid() and t.status = 'DRAFT'
    )
  );

create policy transaction_media_insert_seller_draft on public.transaction_media
  for insert with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.seller_id = auth.uid() and t.status = 'DRAFT'
    )
  );

-- NO direct UPDATE/INSERT grants for status or participants:
--   * transactions.status changes ONLY through internal.transition_transaction
--   * transaction_participants rows are written by the accept flow (server-side)
--   * transaction_status_history is written by the transition function