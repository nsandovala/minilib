import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
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
  createdAt:  timestamp('created_at',  { withTimezone: true }).notNull(),
  updatedAt:  timestamp('updated_at',  { withTimezone: true }).notNull(),
  deletedAt:  timestamp('deleted_at',  { withTimezone: true }),
});

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
