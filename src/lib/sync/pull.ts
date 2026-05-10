// Client-only — never import db/cloud/client here.
import { db } from '@/db';
import type { EntryType, TimelineEntry, ChecklistItem } from '@/types';
import type { EntryPayload, ChecklistItemPayload } from './types';
import { decodeEntryTagsFromSync } from '@/lib/entries';
import { upsertChecklistItemFromSync } from '@/db/checklist';

function payloadToEntry(p: EntryPayload): Omit<TimelineEntry, 'id'> {
  const decoded = decodeEntryTagsFromSync(p.tags);
  return {
    localId:   p.localId,
    text:      p.text,
    type:      p.type as EntryType,
    title:     p.title,
    date:      p.date ?? null,
    time:      p.entryTime ?? null,
    tags:      decoded.tags,
    done:      p.done,
    amount:    p.amount ?? null,
    checklistItems: decoded.checklistItems,
    listItems: decoded.listItems,
    listGroups: decoded.listGroups,
    detectedTags: decoded.detectedTags,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    syncedAt:  new Date(),
  };
}

function payloadToChecklistItem(p: ChecklistItemPayload): Omit<ChecklistItem, 'id'> {
  return {
    localId:      p.localId,
    localEntryId: p.localEntryId,
    label:        p.label,
    checked:      p.checked,
    category:     p.category,
    sortOrder:    p.sortOrder ?? 0,
    createdAt:    new Date(p.createdAt),
    updatedAt:    new Date(p.updatedAt),
    syncedAt:     new Date(),
    deletedAt:    p.deletedAt ? new Date(p.deletedAt) : null,
  };
}

export async function pull(): Promise<void> {
  const res = await fetch('/api/sync/pull');
  if (!res.ok) return;

  const body = (await res.json()) as {
    entries: EntryPayload[];
    checklistItems?: ChecklistItemPayload[];
  };

  const remote = body.entries ?? [];
  const remoteItems = body.checklistItems ?? [];

  if (!remote.length && !remoteItems.length) return;

  // Merge entries (last-write-wins)
  if (remote.length) {
    const local = await db.entries.toArray();
    const byLocalId = new Map<string, TimelineEntry>(local.map((e) => [e.localId, e]));
    const now = new Date();

    for (const p of remote) {
      const existing = byLocalId.get(p.localId);
      const decoded  = decodeEntryTagsFromSync(p.tags);

      if (!existing) {
        await db.entries.add(payloadToEntry(p));
        continue;
      }

      const remoteUpdated = new Date(p.updatedAt);
      const localUpdated  = existing.updatedAt ?? existing.createdAt;

      if (remoteUpdated > localUpdated) {
        await db.entries.update(existing.id!, {
          text:      p.text,
          type:      p.type as EntryType,
          title:     p.title,
          date:      p.date ?? null,
          time:      p.entryTime ?? null,
          tags:      decoded.tags,
          done:      p.done,
          amount:    p.amount ?? null,
          checklistItems: decoded.checklistItems,
          listItems: decoded.listItems,
          listGroups: decoded.listGroups,
          detectedTags: decoded.detectedTags,
          updatedAt: remoteUpdated,
          syncedAt:  now,
        });
      }
    }
  }

  // Merge checklist items (last-write-wins via upsertChecklistItemFromSync)
  for (const p of remoteItems) {
    await upsertChecklistItemFromSync(payloadToChecklistItem(p));
  }
}
