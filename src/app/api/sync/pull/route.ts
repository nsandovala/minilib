import { auth } from '@clerk/nextjs/server';
import { getEntriesForUser, getChecklistItemsForUser } from '@/db/cloud/queries';
import type { CloudEntry, CloudChecklistItem } from '@/db/cloud/schema';
import type { EntryPayload, ChecklistItemPayload } from '@/lib/sync/types';

function cloudEntryToPayload(row: CloudEntry): EntryPayload {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags);
    if (Array.isArray(parsed)) tags = parsed as string[];
  } catch {
    tags = [];
  }

  return {
    localId:   row.id,
    text:      row.text,
    type:      row.type,
    title:     row.title,
    date:      row.date ?? null,
    entryTime: row.entryTime ?? null,
    tags,
    done:      row.done,
    amount:    row.amount ?? null,
    metadata:  row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function cloudItemToPayload(row: CloudChecklistItem): ChecklistItemPayload {
  return {
    localId:      row.id,
    localEntryId: row.entryId,
    label:        row.label,
    checked:      row.checked,
    category:     row.category ?? null,
    sortOrder:    row.sortOrder ?? 0,
    createdAt:    row.createdAt.toISOString(),
    updatedAt:    row.updatedAt.toISOString(),
    deletedAt:    row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    if (process.env.NODE_ENV !== 'production') console.warn('[pull] 401 — no userId from Clerk');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [entryRows, itemRows] = await Promise.all([
      getEntriesForUser(userId),
      getChecklistItemsForUser(userId),
    ]);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[pull] 200 — entries:${entryRows.length} items:${itemRows.length}`);
    }

    return Response.json({
      entries:        entryRows.map(cloudEntryToPayload),
      checklistItems: itemRows.map(cloudItemToPayload),
    });
  } catch (err) {
    console.error('[pull] 500 —', err instanceof Error ? err.message : 'unknown error');
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
