-- DealSure financial layer: payment_intents (public read-only),
-- internal.payment_events, provider_webhook_events, ledger (append-only,
-- balanced), settlements, refunds, risk_flags, admin_notes.
-- The browser can NEVER INSERT/UPDATE any of these directly.

-- dealsure_owner must hold CREATE on schema public to become the owner of
-- public.payment_intents (hosted postgres is not a superuser). internal-schema
-- objects need no grant: dealsure_owner owns the internal schema (0001).
-- Revoked at the end of this migration. See
-- docs/architecture/database-ownership-decision.md.
grant create on schema public to dealsure_owner;

-- ---------------------------------------------------------------------------
-- public.payment_intents — visible to payer/participants/staff (read-only)
-- ---------------------------------------------------------------------------
create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id),
  payer_id uuid not null references public.profiles (id),
  provider text not null,
  provider_intent_id text,
  provider_event_id text unique,
  idempotency_key text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'PENDING' check (status in ('PENDING', 'SECURED', 'REFUNDED', 'FAILED', 'CANCELLED')),
  raw_event jsonb,
  created_at timestamptz not null default now(),
  secured_at timestamptz,
  unique (transaction_id, idempotency_key)
);

create index payment_intents_by_tx on public.payment_intents (transaction_id, created_at desc);
create index payment_intents_by_payer on public.payment_intents (payer_id, created_at desc);
create index payment_intents_by_event on public.payment_intents (provider_event_id);
alter table public.payment_intents owner to dealsure_owner;

alter table public.payment_intents enable row level security;

create policy payment_intents_select_payer on public.payment_intents
  for select using (payer_id = auth.uid());

create policy payment_intents_select_participant on public.payment_intents
  for select using (internal.can_view_transaction(transaction_id));

create policy payment_intents_select_staff on public.payment_intents
  for select using (internal.is_staff());

-- No INSERT/UPDATE policies: payment creation and verification are server-only.

-- ---------------------------------------------------------------------------
-- internal.payment_events — raw provider events (append-only, deduped)
-- ---------------------------------------------------------------------------
create table internal.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents (id),
  provider_event_id text not null unique,
  type text not null,
  raw jsonb,
  received_at timestamptz not null default now()
);

create index payment_events_by_intent on internal.payment_events (payment_intent_id, received_at);
alter table internal.payment_events owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.provider_webhook_events — signature-verified, idempotent webhooks
-- ---------------------------------------------------------------------------
create table internal.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  raw jsonb not null,
  signature_verified boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, provider_event_id)
);

alter table internal.provider_webhook_events owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal ledger — append-only double-entry
-- ---------------------------------------------------------------------------
create table internal.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null check (type in ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY')),
  currency char(3) not null default 'NGN' check (currency = 'NGN')
);

alter table internal.ledger_accounts owner to dealsure_owner;

create table internal.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  ref_id text not null unique,
  transaction_id uuid references public.transactions (id),
  memo text not null,
  reversal_of_id uuid references internal.ledger_transactions (id),
  created_at timestamptz not null default now()
);

alter table internal.ledger_transactions owner to dealsure_owner;

create table internal.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  ledger_transaction_id uuid not null references internal.ledger_transactions (id),
  account_id uuid not null references internal.ledger_accounts (id),
  debit_minor bigint not null default 0 check (debit_minor >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  memo text,
  check ((debit_minor = 0) <> (credit_minor = 0))  -- exactly one side non-zero
);

create index ledger_entries_by_lt on internal.ledger_entries (ledger_transaction_id);
create index ledger_entries_by_account on internal.ledger_entries (account_id, id);
alter table internal.ledger_entries owner to dealsure_owner;

-- Deferred balance check: every ledger transaction must have sum(debit) =
-- sum(credit); validated at commit so both legs can be inserted together.
create or replace function internal.assert_ledger_balance()
returns trigger
language plpgsql
as $$
declare
  v_lt uuid;
  v_debit bigint;
  v_credit bigint;
begin
  v_lt := coalesce(new.ledger_transaction_id, old.ledger_transaction_id);
  select coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0)
    into v_debit, v_credit
    from internal.ledger_entries
   where ledger_transaction_id = v_lt;
  if v_debit <> v_credit then
    raise exception 'Ledger imbalance for %: debits (%) must equal credits (%)', v_lt, v_debit, v_credit;
  end if;
  return null;
end;
$$;

alter function internal.assert_ledger_balance() owner to dealsure_owner;

drop trigger if exists trg_ledger_balance on internal.ledger_entries;
create constraint trigger trg_ledger_balance
  after insert or update or delete on internal.ledger_entries
  deferrable initially deferred
  for each row execute function internal.assert_ledger_balance();

-- Append-only enforcement for ledger entries.
create or replace function internal.ledger_entries_append_only()
returns trigger language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'ledger_entries is append-only';
  end if;
  return new;
end;
$$;

-- TRUNCATE only fires statement-level triggers, so it needs a separate one.
create or replace function internal.ledger_entries_no_truncate()
returns trigger language plpgsql as $$
begin
  raise exception 'ledger_entries is append-only';
end;
$$;

drop trigger if exists trg_ledger_entries_append_only on internal.ledger_entries;
create trigger trg_ledger_entries_append_only
  before insert or update or delete on internal.ledger_entries
  for each row execute function internal.ledger_entries_append_only();

drop trigger if exists trg_ledger_entries_no_truncate on internal.ledger_entries;
create trigger trg_ledger_entries_no_truncate
  before truncate on internal.ledger_entries
  for each statement execute function internal.ledger_entries_no_truncate();

alter function internal.ledger_entries_append_only() owner to dealsure_owner;
alter function internal.ledger_entries_no_truncate() owner to dealsure_owner;

-- Post a balanced pair (SECURITY DEFINER — used by Edge Functions and tests).
create or replace function internal.post_double_entry(
  p_ref_id text,
  p_transaction_id uuid,
  p_memo text,
  p_debit_code text,
  p_credit_code text,
  p_amount_minor bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_lt_id uuid;
  v_debit_id uuid;
  v_credit_id uuid;
begin
  if p_amount_minor <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select id into v_debit_id from internal.ledger_accounts where code = p_debit_code;
  if v_debit_id is null then
    raise exception 'Unknown ledger account: %', p_debit_code;
  end if;
  select id into v_credit_id from internal.ledger_accounts where code = p_credit_code;
  if v_credit_id is null then
    raise exception 'Unknown ledger account: %', p_credit_code;
  end if;

  insert into internal.ledger_transactions (ref_id, transaction_id, memo)
  values (p_ref_id, p_transaction_id, p_memo)
  returning id into v_lt_id;

  insert into internal.ledger_entries (ledger_transaction_id, account_id, debit_minor, credit_minor, memo)
  values (v_lt_id, v_debit_id, p_amount_minor, 0, p_memo || ' [debit]'),
         (v_lt_id, v_credit_id, 0, p_amount_minor, p_memo || ' [credit]');

  return v_lt_id;
end;
$$;

alter function internal.post_double_entry(text, uuid, text, text, text, bigint) owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.settlements — one PAID settlement per transaction (DB-enforced)
-- ---------------------------------------------------------------------------
create table internal.settlements (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id),
  recipient_id uuid not null references public.profiles (id),
  provider text not null,
  provider_ref text unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  status text not null check (status in ('PENDING', 'PAID', 'FAILED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Hard guard against double payouts (blocks concurrent settlement races).
create unique index settlements_one_paid_per_tx
  on internal.settlements (transaction_id) where status = 'PAID';

alter table internal.settlements owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.refunds — full/partial, capped at remaining refundable amount
-- ---------------------------------------------------------------------------
create table internal.refunds (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id),
  payer_id uuid not null references public.profiles (id),
  provider text not null,
  provider_ref text unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  reason text,
  status text not null check (status in ('PENDING', 'PAID', 'FAILED')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (transaction_id, idempotency_key)
);

alter table internal.refunds owner to dealsure_owner;

-- Guard: amount_minor <= total_minor - sum(existing refunds) for the
-- transaction; currency must match; transaction must be in an eligible state.
create or replace function internal.refunds_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_tx public.transactions%rowtype;
  v_previous bigint;
begin
  select * into v_tx from public.transactions where id = new.transaction_id for update;
  if v_tx is null then
    raise exception 'Transaction not found';
  end if;

  if new.currency <> v_tx.currency then
    raise exception 'Refund currency does not match transaction currency';
  end if;

  if v_tx.status not in ('PAYMENT_PROCESSING', 'PAYMENT_SECURED', 'READY_FOR_DELIVERY',
                         'DISPATCHED', 'DELIVERED_PENDING_INSPECTION', 'ACCEPTED',
                         'RELEASE_PENDING', 'DISPUTED', 'REFUND_PENDING') then
    raise exception 'Transaction is not refundable in state %', v_tx.status;
  end if;

  select coalesce(sum(amount_minor), 0) into v_previous
    from internal.refunds
   where transaction_id = new.transaction_id
     and status in ('PENDING', 'PAID');

  if new.amount_minor + v_previous > v_tx.total_minor then
    raise exception 'Refund amount exceeds refundable balance (remaining %)',
      v_tx.total_minor - v_previous;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_refunds_before_insert on internal.refunds;
create trigger trg_refunds_before_insert
  before insert on internal.refunds
  for each row execute function internal.refunds_before_insert();

alter function internal.refunds_before_insert() owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.risk_flags / internal.admin_notes — ops-only
-- ---------------------------------------------------------------------------
create table internal.risk_flags (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions (id),
  profile_id uuid references public.profiles (id),
  flagged_by uuid references public.profiles (id),
  reason text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH')),
  status text not null default 'OPEN' check (status in ('OPEN', 'REVIEWED', 'CLEARED')),
  created_at timestamptz not null default now()
);

create index risk_flags_by_tx on internal.risk_flags (transaction_id);
create index risk_flags_by_profile on internal.risk_flags (profile_id);
alter table internal.risk_flags owner to dealsure_owner;

create table internal.admin_notes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions (id),
  author_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create index admin_notes_by_tx on internal.admin_notes (transaction_id, created_at);
alter table internal.admin_notes owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- Server-only read accessors (staff, SECURITY DEFINER) — the Data API has no
-- grants on internal tables, so staff reads go through these functions.
-- ---------------------------------------------------------------------------
create or replace function internal.get_audit_log(
  p_limit int default 100,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns setof internal.audit_logs
language sql
security definer
stable
set search_path = internal, public
as $$
  select al.*
  from internal.audit_logs al
  where internal.has_role_any(ARRAY['operations_admin', 'finance_admin', 'super_admin'])
    and (p_entity_type is null or al.entity_type = p_entity_type)
    and (p_entity_id is null or al.entity_id = p_entity_id)
  order by al.at desc
  limit greatest(1, least(p_limit, 1000));
$$;

alter function internal.get_audit_log(int, text, uuid) owner to dealsure_owner;
grant execute on function internal.get_audit_log(int, text, uuid) to authenticated;-- Chart of accounts (dev baseline; matches codes used by the Convex ledger).
insert into internal.ledger_accounts (code, name, type, currency) values
  ('1000', 'Custody asset (payment partner)', 'ASSET', 'NGN'),
  ('2000', 'Buyer payable (escrow-like liability)', 'LIABILITY', 'NGN'),
  ('4000', 'Fee revenue', 'REVENUE', 'NGN')
on conflict (code) do nothing;

-- Ownership capability cleanup (scoped to this migration; see file head).
revoke create on schema public from dealsure_owner;
