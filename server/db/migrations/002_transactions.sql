-- 002_transactions.sql — core transaction engine tables.
-- IDs are portable TEXT (UUID). Money is INTEGER minor units. Statuses are
-- a closed CHECK list matching the canonical lifecycle; only the trusted
-- transition service may move rows between them (enforced in services, with
-- every change appended to transaction_status_history).

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  invite_slug TEXT NOT NULL UNIQUE,
  transaction_origin TEXT NOT NULL DEFAULT 'SHARE_LINK' CHECK (transaction_origin IN (
    'SHARE_LINK', 'MARKETPLACE', 'MERCHANT_CHECKOUT', 'API', 'ADMIN_ASSISTED', 'PARTNER'
  )),
  seller_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  buyer_id TEXT REFERENCES profiles (id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  delivery_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_minor >= 0),
  platform_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT', 'PENDING_BUYER_ACCEPTANCE', 'AWAITING_PAYMENT', 'PAYMENT_PROCESSING',
    'PAYMENT_SECURED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'DELIVERED_PENDING_INSPECTION',
    'ACCEPTED', 'RELEASE_PENDING', 'SETTLED', 'DISPUTED', 'REFUND_PENDING',
    'REFUNDED', 'CANCELLED', 'EXPIRED'
  )),
  inspection_deadline INTEGER,
  expires_at INTEGER,
  dispute_blocked INTEGER NOT NULL DEFAULT 0 CHECK (dispute_blocked IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE transaction_participants (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller')),
  email TEXT,
  accepted_at INTEGER,
  UNIQUE (transaction_id, profile_id)
) STRICT;

CREATE TABLE transaction_items (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (unit_amount_minor >= 0),
  note TEXT
) STRICT;

CREATE TABLE transaction_media (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  storage_key TEXT,
  url TEXT,
  kind TEXT NOT NULL DEFAULT 'image',
  mime_type TEXT,
  size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE transaction_status_history (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  meta TEXT,
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX transactions_by_seller ON transactions (seller_id, status, created_at);
CREATE INDEX transactions_by_buyer ON transactions (buyer_id, status, created_at);
CREATE INDEX transactions_by_status ON transactions (status, created_at);
CREATE INDEX transaction_participants_by_profile ON transaction_participants (profile_id, transaction_id);
CREATE INDEX transaction_status_history_by_tx ON transaction_status_history (transaction_id, created_at);
