-- 007_ledger.sql — double-entry accounting foundation.
-- ledger_transactions is the journal PARENT (missing in the Convex
-- implementation); every journal carries multiple entries with
-- sum(debits) == sum(credits). Journal balance is validated atomically by
-- the LedgerService/LedgerRepository inside one database transaction —
-- SQLite has no deferred multi-row CHECK, so this file documents (not
-- fakes) that division of responsibility. History is append-only:
-- corrections use reversal journals referencing reversal_of_id.

CREATE TABLE ledger_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY')),
  currency TEXT NOT NULL DEFAULT 'NGN'
) STRICT;

CREATE TABLE ledger_transactions (
  id TEXT PRIMARY KEY,
  ref_id TEXT NOT NULL UNIQUE,
  transaction_id TEXT REFERENCES transactions (id) ON DELETE RESTRICT,
  memo TEXT NOT NULL,
  reversal_of_id TEXT REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  ledger_transaction_id TEXT NOT NULL REFERENCES ledger_transactions (id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES ledger_accounts (id) ON DELETE RESTRICT,
  debit_minor INTEGER NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor INTEGER NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  memo TEXT,
  CHECK ((debit_minor = 0) <> (credit_minor = 0))
) STRICT;

CREATE INDEX ledger_entries_by_journal ON ledger_entries (ledger_transaction_id);
CREATE INDEX ledger_entries_by_account ON ledger_entries (account_id, id);

-- Baseline chart of accounts (reference data, not dev fixtures).
INSERT INTO ledger_accounts (id, code, name, type, currency) VALUES
  ('acct_custody_asset', '1000', 'Custody asset (payment partner)', 'ASSET', 'NGN'),
  ('acct_buyer_payable', '2000', 'Buyer payable (escrow-like liability)', 'LIABILITY', 'NGN'),
  ('acct_fee_revenue', '4000', 'Fee revenue', 'REVENUE', 'NGN');
