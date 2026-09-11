-- 009_notifications_risk_audit.sql — operations tables.
-- notifications are server-authored; clients may only mark read state
-- (enforced by services — no open UPDATE surface by design).
-- audit_logs is append-only by repository/service contract: no UPDATE/DELETE
-- paths exist; sensitive values (passwords, OTP, tokens, secrets) are never
-- written here. risk_flags stay transparent and reviewable — no opaque score.

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions (id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE risk_flags (
  id TEXT PRIMARY KEY,
  transaction_id TEXT REFERENCES transactions (id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profiles (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWED', 'CLEARED')),
  reviewed_by TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE admin_notes (
  id TEXT PRIMARY KEY,
  transaction_id TEXT REFERENCES transactions (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX notifications_by_user ON notifications (profile_id, read_at, created_at);
CREATE INDEX audit_logs_by_entity ON audit_logs (entity_type, entity_id, created_at);
CREATE INDEX risk_flags_by_tx ON risk_flags (transaction_id);
CREATE INDEX risk_flags_by_profile ON risk_flags (profile_id);
