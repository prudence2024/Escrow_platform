-- 010_terms_kyc.sql — legal acceptances, KYC state, payout destinations.
-- terms_versions rows are immutable: acceptances reference a version id, so
-- historical consent never silently points at edited text. KYC stores STATE
-- and external references only — never raw identity document bodies.
-- bank_accounts minimize sensitive data; future provider recipient/token
-- references replace locally stored banking data where practical.

CREATE TABLE terms_versions (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  content TEXT NOT NULL,
  effective_at INTEGER NOT NULL
) STRICT;

CREATE TABLE terms_acceptances (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  terms_version_id TEXT NOT NULL REFERENCES terms_versions (id) ON DELETE RESTRICT,
  transaction_id TEXT REFERENCES transactions (id) ON DELETE SET NULL,
  accepted_at INTEGER NOT NULL,
  metadata TEXT,
  UNIQUE (profile_id, terms_version_id)
) STRICT;

CREATE TABLE kyc_profiles (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL UNIQUE REFERENCES profiles (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN (
    'UNVERIFIED', 'SUBMITTED', 'VERIFIED', 'REJECTED'
  )),
  doc_type TEXT,
  document_reference TEXT,
  verified_at INTEGER,
  rejected_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE bank_accounts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  provider TEXT,
  provider_recipient_reference TEXT,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL CHECK (account_number GLOB '[0-9]*'),
  bank_name TEXT NOT NULL,
  bank_code TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (profile_id, account_number)
) STRICT;
