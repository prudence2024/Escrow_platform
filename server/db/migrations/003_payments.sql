-- 003_payments.sql — payment intents, provider events, webhook inbox.
-- DEVELOPMENT/SANDBOX schema: no live provider behavior is implied by these
-- tables. Webhook processing rules (signature, idempotency, replay) are
-- enforced by services; the UNIQUE constraints here are the backstop.

CREATE TABLE payment_intents (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE RESTRICT,
  payer_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_reference TEXT UNIQUE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'SECURED', 'REFUNDED', 'FAILED', 'CANCELLED'
  )),
  idempotency_key TEXT NOT NULL,
  secured_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE (transaction_id, idempotency_key)
) STRICT;

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL REFERENCES payment_intents (id) ON DELETE CASCADE,
  provider_event_id TEXT NOT NULL,
  type TEXT NOT NULL,
  raw TEXT,
  received_at INTEGER NOT NULL,
  -- Replay protection is scoped to (intent, provider event): the same event
  -- delivered twice for one intent is a duplicate, while identical event ID
  -- strings from different providers/intents must not falsely collide.
  UNIQUE (payment_intent_id, provider_event_id)
) STRICT;

CREATE TABLE provider_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  normalized_type TEXT,
  raw TEXT,
  signature_verified INTEGER NOT NULL DEFAULT 0 CHECK (signature_verified IN (0, 1)),
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN (
    'RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED_DUPLICATE'
  )),
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  error TEXT,
  UNIQUE (provider, provider_event_id)
) STRICT;

CREATE INDEX payment_intents_by_tx ON payment_intents (transaction_id);
CREATE INDEX payment_events_by_intent ON payment_events (payment_intent_id, received_at);
