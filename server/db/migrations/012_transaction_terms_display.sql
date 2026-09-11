-- 012_transaction_terms_display.sql — invite/terms display columns.
--
-- Post-baseline addition (follows the freeze rule: new file, never an edit
-- to 001–011). The invite preview must show inspection and return terms, so
-- the transaction row carries them as nullable product data. Services treat
-- NULL as "not specified by seller" (no silent defaults in storage).

ALTER TABLE transactions ADD COLUMN inspection_window_days INTEGER
  CHECK (inspection_window_days IS NULL OR inspection_window_days BETWEEN 1 AND 30);

ALTER TABLE transactions ADD COLUMN return_terms TEXT;
