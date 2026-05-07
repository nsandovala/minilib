import type { TimelineEntry, EntryType } from '@/types';

export interface QueryFilter {
  type?: EntryType;
  done?: boolean;
  tag?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function queryEntries(
  entries: TimelineEntry[],
  filter: QueryFilter
): TimelineEntry[] {
  let result = entries;

  if (filter.type !== undefined) {
    result = result.filter((e) => e.type === filter.type);
  }

  if (filter.done !== undefined) {
    result = result.filter((e) => e.done === filter.done);
  }

  if (filter.tag !== undefined) {
    result = result.filter((e) => e.tags.includes(filter.tag!));
  }

  if (filter.search) {
    const q = filter.search.toLowerCase();
    result = result.filter(
      (e) =>
        e.text.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q)
    );
  }

  if (filter.dateFrom) {
    result = result.filter(
      (e) => e.date && e.date >= filter.dateFrom!
    );
  }

  if (filter.dateTo) {
    result = result.filter(
      (e) => e.date && e.date <= filter.dateTo!
    );
  }

  return result;
}

export function countByType(entries: TimelineEntry[]): Record<EntryType, number> {
  const counts: Record<string, number> = {
    note: 0,
    task: 0,
    reminder: 0,
    health: 0,
    appointment: 0,
    payment: 0,
    pet: 0,
  };

  for (const entry of entries) {
    counts[entry.type] = (counts[entry.type] || 0) + 1;
  }

  return counts as Record<EntryType, number>;
}

export function getPendingCount(entries: TimelineEntry[]): number {
  return entries.filter((e) => !e.done).length;
}

export function getByType(
  entries: TimelineEntry[],
  type: EntryType
): TimelineEntry[] {
  return entries.filter((e) => e.type === type);
}

export function getOverdue(entries: TimelineEntry[]): TimelineEntry[] {
  const todayStr = new Date().toISOString().split('T')[0];
  return entries.filter(
    (e) => !e.done && e.date && e.date < todayStr
  );
}
