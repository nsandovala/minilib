// Server-only — never import this from client components.
import { eq, isNull, and, sql } from 'drizzle-orm';
import { getCloudDb } from './client';
import { entries, checklistItems } from './schema';
import type { CloudEntry, CloudEntryInsert, CloudChecklistItem, CloudChecklistItemInsert } from './schema';

export async function upsertEntries(payload: CloudEntryInsert[]): Promise<void> {
  if (!payload.length) return;
  const cloudDb = getCloudDb();
  await cloudDb
    .insert(entries)
    .values(payload)
    .onConflictDoUpdate({
      target: entries.id,
      set: {
        text:      sql`EXCLUDED.text`,
        type:      sql`EXCLUDED.type`,
        title:     sql`EXCLUDED.title`,
        date:      sql`EXCLUDED.date`,
        entryTime: sql`EXCLUDED.entry_time`,
        tags:      sql`EXCLUDED.tags`,
        done:      sql`EXCLUDED.done`,
        amount:    sql`EXCLUDED.amount`,
        metadata:  sql`EXCLUDED.metadata`,
        updatedAt: sql`EXCLUDED.updated_at`,
        deletedAt: sql`EXCLUDED.deleted_at`,
      },
    });
}

export async function upsertChecklistItems(payload: CloudChecklistItemInsert[]): Promise<void> {
  if (!payload.length) return;
  const cloudDb = getCloudDb();
  await cloudDb
    .insert(checklistItems)
    .values(payload)
    .onConflictDoUpdate({
      target: checklistItems.id,
      set: {
        label:     sql`EXCLUDED.label`,
        checked:   sql`EXCLUDED.checked`,
        category:  sql`EXCLUDED.category`,
        sortOrder: sql`EXCLUDED.sort_order`,
        updatedAt: sql`EXCLUDED.updated_at`,
        deletedAt: sql`EXCLUDED.deleted_at`,
      },
    });
}

export async function getEntriesForUser(userId: string): Promise<CloudEntry[]> {
  const cloudDb = getCloudDb();
  return cloudDb
    .select()
    .from(entries)
    .where(and(eq(entries.userId, userId), isNull(entries.deletedAt)));
}

export async function getChecklistItemsForUser(userId: string): Promise<CloudChecklistItem[]> {
  // Returns all items including soft-deleted so deletions propagate to other devices.
  const cloudDb = getCloudDb();
  return cloudDb
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.userId, userId));
}
