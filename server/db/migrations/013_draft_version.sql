-- 013_draft_version.sql — optimistic concurrency for private draft editing.
--
-- Adds a version column to transactions for conflict detection during
-- concurrent draft edits. Starts at 1 on creation; PATCH requires the
-- caller to supply the expected version and increments it atomically.

ALTER TABLE transactions ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
