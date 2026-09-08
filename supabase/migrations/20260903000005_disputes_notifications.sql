-- DealSure disputes + notifications.

-- dealsure_owner must hold CREATE on schema public to become the owner of the
-- public objects created here (hosted postgres is not a superuser). Revoked at
-- the end of this migration. See docs/architecture/database-ownership-decision.md.
grant create on schema public to dealsure_owner;

-- ---------------------------------------------------------------------------
-- public.disputes
-- ---------------------------------------------------------------------------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  opened_by uuid not null references public.profiles (id),
  reason text not null,
  details text,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'REFUNDED', 'CLOSED')),
  resolution text check (resolution in ('seller_settlement', 'buyer_refund', 'partial_refund')),
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index disputes_by_tx on public.disputes (transaction_id, created_at desc);
create index disputes_by_opened_by on public.disputes (opened_by, created_at desc);
create index disputes_by_status on public.disputes (status, created_at desc);
alter table public.disputes owner to dealsure_owner;

-- One open dispute per transaction (enforced at the DB level).
create unique index disputes_one_open_per_tx
  on public.disputes (transaction_id) where status = 'OPEN';

-- Opening a dispute must move the transaction to DISPUTED (unless already there)
-- and must fail when the transaction is terminal.
create or replace function public.disputes_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_status text;
  v_tx public.transactions%rowtype;
begin
  select * into v_tx from public.transactions where id = new.transaction_id for update;
  if v_tx is null then
    raise exception 'Transaction not found';
  end if;
  if v_tx.status in ('SETTLED', 'REFUNDED', 'CANCELLED', 'EXPIRED') then
    raise exception 'This transaction can no longer be disputed';
  end if;
  if v_tx.status = 'DRAFT' or v_tx.status = 'PENDING_BUYER_ACCEPTANCE'
     or v_tx.status = 'AWAITING_PAYMENT' or v_tx.status = 'PAYMENT_PROCESSING' then
    raise exception 'A dispute cannot be opened in the state %', v_tx.status;
  end if;
  if v_tx.status <> 'DISPUTED' then
    perform internal.transition_transaction(v_tx.id, 'DISPUTED', new.opened_by, 'Dispute opened: ' || new.reason);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_disputes_after_insert on public.disputes;
create trigger trg_disputes_after_insert
  after insert on public.disputes
  for each row execute function public.disputes_after_insert();

alter function public.disputes_after_insert() owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- public.dispute_messages / public.dispute_evidence
-- ---------------------------------------------------------------------------
create table public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) > 0),
  created_at timestamptz not null default now()
);

create index dispute_messages_by_dispute on public.dispute_messages (dispute_id, created_at);
alter table public.dispute_messages owner to dealsure_owner;

create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id),
  storage_path text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index dispute_evidence_by_dispute on public.dispute_evidence (dispute_id, created_at);
alter table public.dispute_evidence owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- public.notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  transaction_id uuid references public.transactions (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_by_profile on public.notifications (profile_id, created_at desc);
create index notifications_by_profile_unread on public.notifications (profile_id, read_at, created_at desc);
alter table public.notifications owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
alter table public.dispute_evidence enable row level security;
alter table public.notifications enable row level security;

-- Dispute visibility: transaction participants or staff.
create policy disputes_select_visible on public.disputes
  for select using (internal.can_view_transaction(transaction_id));

create policy dispute_messages_select_visible on public.dispute_messages
  for select using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_id and internal.can_view_transaction(d.transaction_id)
    )
  );

create policy dispute_evidence_select_visible on public.dispute_evidence
  for select using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_id and internal.can_view_transaction(d.transaction_id)
    )
  );

-- Buyer or seller participant may open a dispute (the trigger validates state
-- and transitions the transaction).
create policy disputes_insert_participant on public.disputes
  for insert with check (
    opened_by = auth.uid()
    and internal.can_view_transaction(transaction_id)
  );

-- Messages/evidence: participants or staff may post; author must be the caller.
create policy dispute_messages_insert_author on public.dispute_messages
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id and internal.can_view_transaction(d.transaction_id)
    )
  );

create policy dispute_evidence_insert_author on public.dispute_evidence
  for insert with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id and internal.can_view_transaction(d.transaction_id)
    )
  );

-- Dispute status/resolution updates: server-only (no UPDATE grants).

-- Notifications: owner-only read/update; creation is server-side only.
create policy notifications_select_own on public.notifications
  for select using (profile_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());-- (no INSERT policy → the Data API cannot create notifications; they are
-- written by internal.notify or Edge Functions with the service role)

-- Ownership capability cleanup (scoped to this migration; see file head).
revoke create on schema public from dealsure_owner;
