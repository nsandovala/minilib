import { auth } from '@clerk/nextjs/server';
import { getEntriesForUser, getChecklistItemsForUser } from '@/db/cloud/queries';
import type { CloudEntry, CloudChecklistItem } from '@/db/cloud/schema';
import type { EntryPayload, ChecklistItemPayload } from '@/lib/sync/types';
import { buildChecklistFingerprint, buildEntryFingerprint } from '@/lib/sync/dedupe';
import { extractLocalId } from '@/db/cloud/identity';

export const dynamic = 'force-dynamic';

function cloudEntryToPayload(userId: string, row: CloudEntry): EntryPayload {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags);
    if (Array.isArray(parsed)) tags = parsed as string[];
  } catch {
    tags = [];
  }

  return {
    localId:   extractLocalId(userId, row.id),
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

function cloudItemToPayload(userId: string, row: CloudChecklistItem): ChecklistItemPayload {
  return {
    localId:      extractLocalId(userId, row.id),
    localEntryId: extractLocalId(userId, row.entryId),
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

    const dedupedEntries = new Map<string, EntryPayload>();
    const entryAliases = new Map<string, string>();

    for (const row of entryRows) {
      const payload = cloudEntryToPayload(userId, row);
      const localIdKey = `id:${payload.localId}`;
      const fingerprintKey = buildEntryFingerprint(userId, {
        type: payload.type,
        title: payload.title,
        text: payload.text,
        date: payload.date,
        amount: payload.amount,
        createdAt: payload.createdAt,
      });
      const current = dedupedEntries.get(localIdKey) ?? dedupedEntries.get(fingerprintKey);
      const winner =
        !current || new Date(payload.updatedAt) >= new Date(current.updatedAt)
          ? payload
          : current;

      dedupedEntries.set(localIdKey, winner);
      dedupedEntries.set(fingerprintKey, winner);
      entryAliases.set(payload.localId, winner.localId);
    }

    const dedupedItems = new Map<string, ChecklistItemPayload>();
    for (const row of itemRows) {
      const payload = cloudItemToPayload(userId, row);
      payload.localEntryId = entryAliases.get(payload.localEntryId) ?? payload.localEntryId;

      const localIdKey = `id:${payload.localId}`;
      const fingerprintKey = buildChecklistFingerprint(userId, {
        localEntryId: payload.localEntryId,
        label: payload.label,
        sortOrder: payload.sortOrder,
        createdAt: payload.createdAt,
      });
      const current = dedupedItems.get(localIdKey) ?? dedupedItems.get(fingerprintKey);
      const winner =
        !current || new Date(payload.updatedAt) >= new Date(current.updatedAt)
          ? payload
          : current;

      dedupedItems.set(localIdKey, winner);
      dedupedItems.set(fingerprintKey, winner);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[pull] 200 — user:${userId.slice(0, 8)} entries:${entryRows.length} items:${itemRows.length}`);
    }

    return Response.json({
      entries:        Array.from(new Set(dedupedEntries.values())),
      checklistItems: Array.from(new Set(dedupedItems.values())),
    });
  } catch (err) {
    console.error('[pull] 500 —', err instanceof Error ? err.message : 'unknown error');
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
