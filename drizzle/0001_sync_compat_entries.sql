-- Compatibility migration to restore sync when cloud schema lags behind code.
-- Safe on existing data: adds nullable columns only.

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS dedupe_key text;

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
