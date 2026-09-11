-- 001_identity.sql — DealSure application identity (profiles + roles).
-- Provider-neutral: no password hashes, no session secrets. Auth sessions
-- stay with the auth provider; these tables model the application user.

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  full_name TEXT,
  phone TEXT,
  country TEXT,
  onboarded INTEGER NOT NULL DEFAULT 0 CHECK (onboarded IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE user_roles (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'buyer', 'seller', 'merchant',
    'support', 'dispute_agent', 'operations', 'finance', 'super_admin'
  )),
  granted_by TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER,
  UNIQUE (profile_id, role)
) STRICT;

CREATE INDEX user_roles_by_profile ON user_roles (profile_id);
