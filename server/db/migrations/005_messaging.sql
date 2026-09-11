-- 005_messaging.sql — transaction workspace communication.
-- Authorship/source is explicit: sender_id NULL marks a trusted SYSTEM event.
-- Ordinary users must never be able to author SYSTEM (or other trusted)
-- message types — enforced by services, with the CHECK list as backstop.

CREATE TABLE transaction_threads (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE transaction_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES transaction_threads (id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  message_type TEXT NOT NULL CHECK (message_type IN (
    'USER', 'SYSTEM', 'PAYMENT_EVENT', 'DELIVERY_EVENT', 'DISPUTE_EVENT', 'SETTLEMENT_EVENT'
  )),
  body TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES transaction_messages (id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE message_read_states (
  message_id TEXT NOT NULL REFERENCES transaction_messages (id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  read_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, profile_id)
) STRICT;

CREATE INDEX transaction_messages_by_thread ON transaction_messages (thread_id, created_at);
