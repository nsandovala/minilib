-- Migration: Add dedupe_key column + partial unique index to entries table
--
-- Run steps IN ORDER:
--   1. Apply this file against your Neon database
--   2. Then run `npx drizzle-kit push` so schema.ts stays in sync
--
-- The CONCURRENTLY index build does NOT lock the table. It is safe to run
-- against a live database. However, it cannot run inside an explicit transaction,
-- so this file must be executed outside a transaction (e.g. via psql directly or
-- the Neon SQL editor with autocommit ON).

-- Step 1: Add the column (no-op if already present).
ALTER TABLE entries ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Step 2: Build the partial unique index without locking.
--   - WHERE dedupe_key IS NOT NULL: historical rows without a key are unaffected.
--   - WHERE deleted_at IS NULL:     a re-created entry does not conflict with its
--                                   soft-deleted twin.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS entries_user_dedupe_key_active_idx
  ON entries(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL;

-- Verify:
-- SELECT indexname, indexdef
--   FROM pg_indexes
--  WHERE tablename = 'entries'
--    AND indexname = 'entries_user_dedupe_key_active_idx';
