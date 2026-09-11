-- 008_settlements_refunds.sql — payouts, refunds, idempotency keys.
-- Double-settlement defense: partial unique index permits any number of
-- non-PAID rows but at most one PAID settlement per transaction.
-- Refund-cap enforcement (cumulative <= refundable) is atomic service-layer
-- logic; the schema contributes amount/status/idempotency constraints.

CREATE TABLE settlements (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE RESTRICT,
  payee_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED')),
  provider TEXT NOT NULL,
  provider_reference TEXT UNIQUE,
  idempotency_key TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
) STRICT;

CREATE UNIQUE INDEX settlements_one_paid_per_tx
  ON settlements (transaction_id) WHERE status = 'PAID';

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE RESTRICT,
  payment_intent_id TEXT REFERENCES payment_intents (id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  requested_by TEXT NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  approved_by TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED')),
  reason TEXT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  provider TEXT NOT NULL,
  provider_reference TEXT UNIQUE,
  idempotency_key TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  UNIQUE (transaction_id, idempotency_key)
) STRICT;

CREATE TABLE idempotency_keys (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  actor_id TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  request_hash TEXT,
  result_type TEXT,
  result_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  UNIQUE (scope, idempotency_key)
) STRICT;

CREATE INDEX settlements_by_tx ON settlements (transaction_id, status);
CREATE INDEX refunds_by_tx ON refunds (transaction_id, status);
