-- 006_disputes.sql — disputes, case messages, evidence metadata.
-- Evidence rows reference private object storage; file bodies are NEVER
-- stored in the database. At most one OPEN dispute per transaction
-- (partial unique index — SQLite supports WHERE on unique indexes).

CREATE TABLE disputes (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  opened_by TEXT NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  category TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
    'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REFUNDED', 'CLOSED'
  )),
  resolution TEXT CHECK (resolution IN (
    'seller_settlement', 'buyer_refund', 'partial_refund'
  )),
  resolution_note TEXT,
  resolved_by TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE UNIQUE INDEX disputes_one_open_per_tx
  ON disputes (transaction_id) WHERE status IN ('OPEN', 'UNDER_REVIEW');

CREATE TABLE dispute_messages (
  id TEXT PRIMARY KEY,
  dispute_id TEXT NOT NULL REFERENCES disputes (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE dispute_evidence (
  id TEXT PRIMARY KEY,
  dispute_id TEXT NOT NULL REFERENCES disputes (id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  storage_key TEXT,
  mime_type TEXT,
  size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX disputes_by_tx ON disputes (transaction_id, created_at);
CREATE INDEX disputes_by_status ON disputes (status, created_at);
CREATE INDEX dispute_messages_by_dispute ON dispute_messages (dispute_id, created_at);
