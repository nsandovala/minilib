// Server-only — never import this from client components.
import { eq, isNull, isNotNull, and, sql } from 'drizzle-orm';
import { getCloudDb } from './client';
import { entries, checklistItems } from './schema';
import type { CloudEntry, CloudEntryInsert, CloudChecklistItem, CloudChecklistItemInsert } from './schema';

function isMissingColumnError(err: unknown, columnName: string): boolean {
  return err instanceof Error && err.message.toLowerCase().includes(`column "${columnName}" does not exist`);
}

function logCompat(message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(message);
  }
}

export async function upsertEntries(payload: CloudEntryInsert[]): Promise<void> {
  if (!payload.length) return;
  const cloudDb = getCloudDb();
  try {
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
          // Backfill dedupe_key if incoming has one; preserve existing key otherwise.
          dedupeKey: sql`COALESCE(EXCLUDED.dedupe_key, entries.dedupe_key)`,
          updatedAt: sql`EXCLUDED.updated_at`,
          deletedAt: sql`EXCLUDED.deleted_at`,
        },
      });
  } catch (err) {
    const missingDedupeKey = isMissingColumnError(err, 'dedupe_key');
    const missingDeletedAt = isMissingColumnError(err, 'deleted_at');
    if (!missingDedupeKey && !missingDeletedAt) throw err;

    logCompat('[cloud] entries upsert fallback enabled due to missing sync compatibility column');

    const values = payload.map((row) => sql`(
      ${row.id},
      ${row.userId},
      ${row.text},
      ${row.type},
      ${row.title},
      ${row.date},
      ${row.entryTime},
      ${row.tags},
      ${row.done},
      ${row.amount},
      ${row.metadata},
      ${row.createdAt},
      ${row.updatedAt}
    )`);

    await cloudDb.execute(sql`
      INSERT INTO entries (
        id, user_id, text, type, title, date, entry_time, tags, done, amount, metadata, created_at, updated_at
      )
      VALUES ${sql.join(values, sql`, `)}
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        date = EXCLUDED.date,
        entry_time = EXCLUDED.entry_time,
        tags = EXCLUDED.tags,
        done = EXCLUDED.done,
        amount = EXCLUDED.amount,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `);
  }
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
  try {
    return await cloudDb
      .select()
      .from(entries)
      .where(and(eq(entries.userId, userId), isNull(entries.deletedAt)));
  } catch (err) {
    const missingDedupeKey = isMissingColumnError(err, 'dedupe_key');
    const missingDeletedAt = isMissingColumnError(err, 'deleted_at');
    if (!missingDedupeKey && !missingDeletedAt) throw err;

    logCompat('[cloud] entries pull fallback enabled due to missing sync compatibility column');

    const rows = await cloudDb.execute(sql`
      SELECT
        id,
        user_id,
        text,
        type,
        title,
        date,
        entry_time,
        tags,
        done,
        amount,
        metadata,
        created_at,
        updated_at
      FROM entries
      WHERE user_id = ${userId}
      ${missingDeletedAt ? sql`` : sql`AND deleted_at IS NULL`}
    `);

    return rows.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      text: String(row.text),
      type: String(row.type),
      title: String(row.title),
      date: row.date ? String(row.date) : null,
      entryTime: row.entry_time ? String(row.entry_time) : null,
      tags: String(row.tags ?? '[]'),
      done: Boolean(row.done),
      amount: typeof row.amount === 'number' ? row.amount : row.amount == null ? null : Number(row.amount),
      metadata: (row.metadata ?? null) as CloudEntry['metadata'],
      dedupeKey: null,
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
      deletedAt: null,
    }));
  }
}

export async function getRecentlyDeletedEntriesForUser(userId: string): Promise<CloudEntry[]> {
  const cloudDb = getCloudDb();
  try {
    return await cloudDb
      .select()
      .from(entries)
      .where(and(
        eq(entries.userId, userId),
        isNotNull(entries.deletedAt),
        sql`${entries.deletedAt} > NOW() - INTERVAL '30 days'`,
      ));
  } catch {
    return [];
  }
}

export async function getChecklistItemsForUser(userId: string): Promise<CloudChecklistItem[]> {
  // Returns all items including soft-deleted so deletions propagate to other devices.
  const cloudDb = getCloudDb();
  return cloudDb
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.userId, userId));
}
