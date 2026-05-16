// Client-only — never import db/cloud/client here.
import { db } from '@/db';
import type { TimelineEntry, ChecklistItem } from '@/types';
import type { EntryPayload, ChecklistItemPayload } from './types';
import { encodeEntryTagsForSync } from '@/lib/entries';
import { getActiveLocalUserId, recordBelongsToUser } from '@/lib/local-user';
import { dedupeChecklistPayloads, dedupeEntryPayloads } from './dedupe';
import { setSyncState } from './state';

function entryToPayload(entry: TimelineEntry): EntryPayload {
  return {
    localId:   entry.localId,
    text:      entry.text,
    type:      entry.type,
    title:     entry.title,
    date:      entry.date ?? null,
    entryTime: entry.time ?? null,
    tags:      encodeEntryTagsForSync(entry),
    done:      entry.done,
    amount:    entry.amount ?? null,
    metadata:  entry.metadata ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: (entry.updatedAt ?? entry.createdAt).toISOString(),
  };
}

function checklistItemToPayload(item: ChecklistItem): ChecklistItemPayload {
  return {
    localId:      item.localId,
    localEntryId: item.localEntryId,
    label:        item.label,
    checked:      item.checked,
    category:     item.category,
    sortOrder:    item.sortOrder ?? 0,
    createdAt:    item.createdAt.toISOString(),
    updatedAt:    item.updatedAt.toISOString(),
    deletedAt:    item.deletedAt ? item.deletedAt.toISOString() : null,
  };
}

function entryNeedsSync(entry: TimelineEntry): boolean {
  if (!entry.syncedAt) return true;
  const updated = entry.updatedAt ?? entry.createdAt;
  return updated > entry.syncedAt;
}

function itemNeedsSync(item: ChecklistItem): boolean {
  if (!item.syncedAt) return true;
  return item.updatedAt > item.syncedAt;
}

export async function push(): Promise<void> {
  const userId = getActiveLocalUserId();
  if (!userId) return;

  const [allEntries, allItems] = await Promise.all([
    db.entries.toArray(),
    db.checklist_items.toArray(),
  ]);

  const dirtyEntries = allEntries.filter((entry) => recordBelongsToUser(entry.ownerUserId, userId) && entryNeedsSync(entry));
  const dirtyItems   = allItems.filter((item) => recordBelongsToUser(item.ownerUserId, userId) && itemNeedsSync(item));

  if (!dirtyEntries.length && !dirtyItems.length) return;

  const res = await fetch('/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entries: dedupeEntryPayloads(userId, dirtyEntries.map(entryToPayload)),
      checklistItems: dedupeChecklistPayloads(userId, dirtyItems.map(checklistItemToPayload)),
    }),
  });

  if (!res.ok) return;

  setSyncState({ lastPushAt: new Date().toISOString() });

  const now = new Date();
  await Promise.all([
    ...dirtyEntries.map((e) =>
      e.id !== undefined ? db.entries.update(e.id, { syncedAt: now }) : Promise.resolve(),
    ),
    ...dirtyItems.map((item) =>
      item.id !== undefined ? db.checklist_items.update(item.id, { syncedAt: now }) : Promise.resolve(),
    ),
  ]);
}
