import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { EntryMetadata } from '@/types';

export const entries = pgTable('entries', {
  id:         text('id').primaryKey(),              // localId from the client
  userId:     text('user_id').notNull(),
  text:       text('text').notNull(),
  type:       text('type').notNull(),
  title:      text('title').notNull(),
  date:       text('date'),
  entryTime:  text('entry_time'),                   // 'time' is a reserved word
  tags:       text('tags').notNull().default('[]'), // JSON string
  done:       boolean('done').notNull().default(false),
  amount:     integer('amount'),
  metadata:   jsonb('metadata').$type<EntryMetadata | null>(),
  // Stable cloud dedupe key — computed server-side on push, never trusted from client.
  // Nullable: historical rows are backfilled gradually via push or repair script.
  // The partial unique index below only activates once dedupe_key is populated.
  dedupeKey:  text('dedupe_key'),
  createdAt:  timestamp('created_at',  { withTimezone: true }).notNull(),
  updatedAt:  timestamp('updated_at',  { withTimezone: true }).notNull(),
  deletedAt:  timestamp('deleted_at',  { withTimezone: true }),
}, (table) => [
  // Partial unique index: guards against same-user semantic duplicates in the cloud.
  // - WHERE dedupe_key IS NOT NULL: historical rows without a key are unaffected.
  // - WHERE deleted_at IS NULL: a re-created entry does not conflict with its soft-deleted twin.
  // Apply this index manually with CONCURRENTLY before running drizzle-kit push:
  //   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS entries_user_dedupe_key_active_idx
  //     ON entries(user_id, dedupe_key)
  //     WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL;
  uniqueIndex('entries_user_dedupe_key_active_idx')
    .on(table.userId, table.dedupeKey)
    .where(sql`dedupe_key IS NOT NULL AND deleted_at IS NULL`),
]);

export const checklistItems = pgTable('checklist_items', {
  id:         text('id').primaryKey(),              // localId UUID
  entryId:    text('entry_id').notNull(),           // parent entry's localId
  userId:     text('user_id').notNull(),
  label:      text('label').notNull(),
  checked:    boolean('checked').notNull().default(false),
  category:   text('category'),
  sortOrder:  integer('sort_order').notNull().default(0),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull(),
  deletedAt:  timestamp('deleted_at', { withTimezone: true }),
});

export type CloudEntry              = typeof entries.$inferSelect;
export type CloudEntryInsert        = typeof entries.$inferInsert;
export type CloudChecklistItem      = typeof checklistItems.$inferSelect;
export type CloudChecklistItemInsert = typeof checklistItems.$inferInsert;
