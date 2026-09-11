-- 004_delivery.sql — deliveries, events, and hashed one-time codes.
-- delivery_otps stores DIGESTS ONLY (HMAC-SHA256 hex + per-record context).
-- Plaintext OTP must never be written here; verification compares digests.

CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  courier_name TEXT,
  tracking_number TEXT,
  carrier_details TEXT,
  dispatched_at INTEGER,
  delivered_at INTEGER,
  inspection_deadline_at INTEGER,
  status TEXT CHECK (status IN ('DISPATCHED', 'DELIVERED', 'CANCELLED'))
) STRICT;

CREATE TABLE delivery_events (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES deliveries (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor_id TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  note TEXT
) STRICT;

CREATE TABLE delivery_otps (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  delivery_id TEXT NOT NULL REFERENCES deliveries (id) ON DELETE CASCADE,
  code_digest TEXT NOT NULL,
  context TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  used_at INTEGER,
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX deliveries_by_tx ON deliveries (transaction_id);
CREATE INDEX delivery_events_by_delivery ON delivery_events (delivery_id, created_at);
CREATE INDEX delivery_otps_by_tx ON delivery_otps (transaction_id);
