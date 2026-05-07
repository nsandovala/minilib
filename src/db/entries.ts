import { db } from '@/db';
import type { ParsedEntry, TimelineEntry } from '@/types';

type CreateEntryInput = Pick<TimelineEntry, 'text' | 'title' | 'type'> &
  Partial<Pick<TimelineEntry, 'date' | 'time' | 'tags' | 'done' | 'amount'>>;

export async function createEntry(data: CreateEntryInput): Promise<number> {
  const now = new Date();
  const id = await db.entries.add({
    text: data.text,
    type: data.type,
    title: data.title,
    date: data.date ?? null,
    time: data.time ?? null,
    tags: data.tags ?? [data.type],
    done: data.done ?? false,
    amount: data.amount ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function addEntry(parsed: ParsedEntry): Promise<number> {
  return createEntry({
    text: parsed.text,
    type: parsed.type,
    title: parsed.title,
    date: parsed.date ?? null,
    time: parsed.time ?? null,
    tags: parsed.tags,
    amount: parsed.amount ?? null,
  });
}

export async function getEntries(): Promise<TimelineEntry[]> {
  return db.entries.orderBy('createdAt').reverse().toArray();
}

export async function toggleEntryDone(id: number, done: boolean): Promise<void> {
  await db.entries.update(id, { done, updatedAt: new Date() });
}

export async function updateEntry(
  id: number,
  data: Partial<
    Pick<TimelineEntry, 'text' | 'title' | 'date' | 'time' | 'tags' | 'done' | 'type'>
  >
): Promise<void> {
  await db.entries.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteEntry(id: number): Promise<void> {
  await db.entries.delete(id);
}
