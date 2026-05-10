import { db } from '@/db';
import type { ParsedEntry, TimelineEntry } from '@/types';
import { createChecklistItems, softDeleteChecklistItemsForEntry } from '@/db/checklist';

type CreateEntryInput = Pick<TimelineEntry, 'text' | 'title' | 'type'> &
  Partial<Pick<TimelineEntry, 'date' | 'time' | 'tags' | 'done' | 'amount' | 'checklistItems' | 'listItems' | 'listGroups' | 'detectedTags'>>;

export async function createEntry(data: CreateEntryInput): Promise<number> {
  const now = new Date();
  const localId = crypto.randomUUID();
  const id = await db.entries.add({
    localId,
    text:     data.text,
    type:     data.type,
    title:    data.title,
    date:     data.date ?? null,
    time:     data.time ?? null,
    tags:     data.tags ?? [data.type],
    done:     data.done ?? false,
    amount:   data.amount ?? null,
    checklistItems: data.checklistItems ?? null,
    listItems: data.listItems ?? null,
    listGroups: data.listGroups ?? null,
    detectedTags: data.detectedTags ?? null,
    createdAt: now,
    updatedAt: now,
    syncedAt:  null,
  });

  // Seed structured checklist items for shopping lists
  if (data.type === 'shopping_list' && data.checklistItems?.length) {
    await createChecklistItems(localId, data.checklistItems);
  }

  return id as number;
}

export async function addEntry(parsed: ParsedEntry): Promise<number> {
  return createEntry({
    text:   parsed.text,
    type:   parsed.type,
    title:  parsed.title,
    date:   parsed.date ?? null,
    time:   parsed.time ?? null,
    tags:   parsed.tags,
    amount: parsed.amount ?? null,
    checklistItems: parsed.checklistItems ?? null,
    listItems: parsed.listItems ?? null,
    listGroups: parsed.listGroups ?? null,
    detectedTags: parsed.detectedTags ?? null,
  });
}

export async function getEntries(): Promise<TimelineEntry[]> {
  return db.entries.orderBy('createdAt').reverse().toArray();
}

export async function toggleEntryDone(id: number, done: boolean): Promise<void> {
  await db.entries.update(id, { done, updatedAt: new Date(), syncedAt: null });
}

export async function updateEntry(
  id: number,
  data: Partial<
    Pick<TimelineEntry, 'text' | 'title' | 'date' | 'time' | 'tags' | 'done' | 'type' | 'amount' | 'checklistItems' | 'listItems' | 'listGroups' | 'detectedTags'>
  >
): Promise<void> {
  await db.entries.update(id, { ...data, updatedAt: new Date(), syncedAt: null });
}

export async function deleteEntry(id: number): Promise<void> {
  const entry = await db.entries.get(id);
  if (entry?.localId) {
    await softDeleteChecklistItemsForEntry(entry.localId);
  }
  await db.entries.delete(id);
}
