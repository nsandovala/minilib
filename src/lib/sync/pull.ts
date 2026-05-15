// Client-only — never import db/cloud/client here.
import { db } from '@/db';
import type { EntryType, TimelineEntry, ChecklistItem } from '@/types';
import type { EntryPayload, ChecklistItemPayload } from './types';
import { decodeEntryTagsFromSync } from '@/lib/entries';
import { upsertChecklistItemFromSync } from '@/db/checklist';
import {
  buildEntryFingerprint,
  dedupeChecklistPayloads,
  dedupeEntryPayloads,
} from './dedupe';
import { getActiveLocalUserId, recordBelongsToUser } from '@/lib/local-user';

function payloadToEntry(p: EntryPayload): Omit<TimelineEntry, 'id'> {
  const ownerUserId = getActiveLocalUserId();
  const decoded = decodeEntryTagsFromSync(p.tags);
  return {
    localId:   p.localId,
    ownerUserId,
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
    metadata:  p.metadata ?? null,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    syncedAt:  new Date(),
  };
}

function payloadToChecklistItem(p: ChecklistItemPayload): Omit<ChecklistItem, 'id'> {
  const ownerUserId = getActiveLocalUserId();
  return {
    localId:      p.localId,
    localEntryId: p.localEntryId,
    ownerUserId,
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
  const userId = getActiveLocalUserId();
  if (!userId) return;

  const res = await fetch('/api/sync/pull');
  if (!res.ok) return;

  const body = (await res.json()) as {
    entries: EntryPayload[];
    checklistItems?: ChecklistItemPayload[];
  };

  const remote = dedupeEntryPayloads(userId, body.entries ?? []);
  const remoteItems = dedupeChecklistPayloads(userId, body.checklistItems ?? []);

  if (!remote.length && !remoteItems.length) return;

  const aliasByRemoteLocalId = new Map<string, string>();

  // Merge entries (last-write-wins)
  if (remote.length) {
    const local = (await db.entries.toArray()).filter((entry) => recordBelongsToUser(entry.ownerUserId, userId));
    const byLocalId = new Map<string, TimelineEntry>(local.map((e) => [e.localId, e]));
    const byFingerprint = new Map<string, TimelineEntry>(
      local.map((entry) => [buildEntryFingerprint(userId, entry), entry]),
    );
    const now = new Date();

    for (const p of remote) {
      const fingerprint = buildEntryFingerprint(userId, {
        type: p.type,
        title: p.title,
        text: p.text,
        date: p.date,
        amount: p.amount,
        createdAt: p.createdAt,
      });
      const existing = byLocalId.get(p.localId) ?? byFingerprint.get(fingerprint);
      const decoded  = decodeEntryTagsFromSync(p.tags);

      if (!existing) {
        await db.entries.add(payloadToEntry(p));
        continue;
      }

      aliasByRemoteLocalId.set(p.localId, existing.localId);

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
          ownerUserId: userId,
          checklistItems: decoded.checklistItems,
          listItems: decoded.listItems,
          listGroups: decoded.listGroups,
          detectedTags: decoded.detectedTags,
          metadata:  p.metadata ?? null,
          updatedAt: remoteUpdated,
          syncedAt:  now,
        });
      }
    }
  }

  // Merge checklist items (last-write-wins via upsertChecklistItemFromSync)
  for (const p of remoteItems) {
    const mappedLocalEntryId = aliasByRemoteLocalId.get(p.localEntryId);
    await upsertChecklistItemFromSync(payloadToChecklistItem({
      ...p,
      localEntryId: mappedLocalEntryId ?? p.localEntryId,
    }));
  }
}
