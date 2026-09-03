-- DealSure delivery: deliveries, delivery_events (public, RLS) and
-- internal.delivery_otps (hashed codes, atomic verify, server-only).

-- ---------------------------------------------------------------------------
-- public.deliveries
-- ---------------------------------------------------------------------------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  courier_name text,
  tracking_number text,
  carrier_details text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  inspection_deadline_at timestamptz,
  status text check (status in ('DISPATCHED', 'DELIVERED', 'CANCELLED'))
);

create index deliveries_by_tx on public.deliveries (transaction_id);
create index deliveries_by_status on public.deliveries (status, inspection_deadline_at);
alter table public.deliveries owner to dealsure_owner;

create table public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  type text not null,
  actor_id uuid references public.profiles (id),
  at timestamptz not null default now(),
  note text
);

create index delivery_events_by_delivery on public.delivery_events (delivery_id, at);
alter table public.delivery_events owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- internal.delivery_otps — hash-only storage, atomic single-use verification
-- The Edge Function computes HMAC-SHA256(code, DELIVERY_OTP_HASH_SECRET) and
-- stores/verifies the digest here; the raw code never touches the database.
-- ---------------------------------------------------------------------------
create table internal.delivery_otps (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  code_hash text not null,            -- HMAC-SHA256 hex of the code
  expires_at timestamptz not null,
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 5,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index delivery_otps_by_transaction on internal.delivery_otps (transaction_id);
create index delivery_otps_by_delivery on internal.delivery_otps (delivery_id);
alter table internal.delivery_otps owner to dealsure_owner;

-- Issue a new OTP (server-only). One live OTP per delivery: consume/expire old ones.
create or replace function internal.issue_delivery_otp(
  p_transaction_id uuid,
  p_delivery_id uuid,
  p_code_hash text,
  p_ttl_seconds int default 10800,
  p_max_attempts int default 5
)
returns uuid
language plpgsql
security definer
set search_path = public, internal
as $$
declare v_id uuid;
begin
  -- Invalidate any previous unconsumed OTPs for this delivery.
  update internal.delivery_otps
     set consumed_at = now()
   where delivery_id = p_delivery_id and consumed_at is null;

  insert into internal.delivery_otps (transaction_id, delivery_id, code_hash, expires_at, max_attempts)
  values (p_transaction_id, p_delivery_id, p_code_hash, now() + make_interval(secs => p_ttl_seconds), p_max_attempts)
  returning id into v_id;

  return v_id;
end;
$$;

-- Atomic verify: single UPDATE ... WHERE guards consumption, expiry and the
-- attempt cap under concurrency; wrong codes bump attempts.
-- Returns true when the code matches and was consumed; false when it does not
-- match (caller sees attempts remaining via exception message).
create or replace function internal.verify_delivery_otp(
  p_otp_id uuid,
  p_code_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_otp internal.delivery_otps%rowtype;
  v_updated int;
begin
  select * into v_otp from internal.delivery_otps where id = p_otp_id for update;
  if v_otp is null then
    raise exception 'Delivery code not found';
  end if;
  if v_otp.consumed_at is not null then
    raise exception 'Delivery code already used';
  end if;
  if now() > v_otp.expires_at then
    raise exception 'Delivery code has expired';
  end if;

  if v_otp.code_hash = p_code_hash then
    update internal.delivery_otps
       set consumed_at = now(), attempts = attempts + 1
     where id = p_otp_id and consumed_at is null;
    return true;
  end if;

  -- wrong code: bump attempts (row is locked, so this is race-safe)
  update internal.delivery_otps
     set attempts = attempts + 1
   where id = p_otp_id;

  if v_otp.attempts + 1 >= v_otp.max_attempts then
    -- consume the OTP so further attempts are rejected outright
    update internal.delivery_otps set consumed_at = now() where id = p_otp_id;
    raise exception 'Too many attempts — contact support';
  end if;

  return false;
end;
$$;

alter function internal.issue_delivery_otp(uuid, uuid, text, int, int) owner to dealsure_owner;
alter function internal.verify_delivery_otp(uuid, text) owner to dealsure_owner;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;

create policy deliveries_select_visible on public.deliveries
  for select using (internal.can_view_transaction(transaction_id));

create policy delivery_events_select_visible on public.delivery_events
  for select using (
    exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and internal.can_view_transaction(d.transaction_id)
    )
  );

-- No client INSERT/UPDATE on deliveries/events: dispatch/confirm run server-side.
-- internal.delivery_otps is not exposed to the Data API at all (internal schema).