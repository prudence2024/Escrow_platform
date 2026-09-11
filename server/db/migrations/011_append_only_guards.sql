-- 011_append_only_guards.sql — DB-level immutability for history tables.
--
-- Fully immutable (BEFORE UPDATE/DELETE abort): ledger_transactions,
-- ledger_entries, audit_logs, payment_events, transaction_status_history,
-- delivery_events. Corrections use reversal journals / new rows, never edits.
--
-- Deliberately NOT guarded (stateful operational records): provider_webhook_
-- events (RECEIVED → PROCESSED transitions), delivery_otps (attempts/use),
-- notifications (read_at), disputes/settlements/refunds (status workflows).

CREATE TRIGGER trg_ledger_transactions_no_update BEFORE UPDATE ON ledger_transactions
BEGIN SELECT RAISE(ABORT, 'ledger_transactions is append-only'); END;

CREATE TRIGGER trg_ledger_transactions_no_delete BEFORE DELETE ON ledger_transactions
BEGIN SELECT RAISE(ABORT, 'ledger_transactions is append-only'); END;

CREATE TRIGGER trg_ledger_entries_no_update BEFORE UPDATE ON ledger_entries
BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;

CREATE TRIGGER trg_ledger_entries_no_delete BEFORE DELETE ON ledger_entries
BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;

CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;

CREATE TRIGGER trg_audit_logs_no_delete BEFORE DELETE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;

CREATE TRIGGER trg_payment_events_no_update BEFORE UPDATE ON payment_events
BEGIN SELECT RAISE(ABORT, 'payment_events is append-only'); END;

CREATE TRIGGER trg_payment_events_no_delete BEFORE DELETE ON payment_events
BEGIN SELECT RAISE(ABORT, 'payment_events is append-only'); END;

CREATE TRIGGER trg_status_history_no_update BEFORE UPDATE ON transaction_status_history
BEGIN SELECT RAISE(ABORT, 'transaction_status_history is append-only'); END;

CREATE TRIGGER trg_status_history_no_delete BEFORE DELETE ON transaction_status_history
BEGIN SELECT RAISE(ABORT, 'transaction_status_history is append-only'); END;

CREATE TRIGGER trg_delivery_events_no_update BEFORE UPDATE ON delivery_events
BEGIN SELECT RAISE(ABORT, 'delivery_events is append-only'); END;

CREATE TRIGGER trg_delivery_events_no_delete BEFORE DELETE ON delivery_events
BEGIN SELECT RAISE(ABORT, 'delivery_events is append-only'); END;
