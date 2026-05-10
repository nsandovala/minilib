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
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [entryRows, itemRows] = await Promise.all([
    getEntriesForUser(userId),
    getChecklistItemsForUser(userId),
  ]);

  return Response.json({
    entries:       entryRows.map(cloudEntryToPayload),
    checklistItems: itemRows.map(cloudItemToPayload),
  });
}
