import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import type { EntryType, TimelineEntry } from '@/types';

interface UseEntriesOptions {
  types?: EntryType[];
  search?: string;
}

function sortEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = (a.updatedAt ?? a.createdAt).getTime();
    const bTime = (b.updatedAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });
}

function filterEntries(entries: TimelineEntry[], options: UseEntriesOptions): TimelineEntry[] {
  const search = options.search?.trim().toLowerCase();

  return entries.filter((entry) => {
    const typeMatch = !options.types?.length || options.types.includes(entry.type);
    if (!typeMatch) return false;

    if (!search) return true;

    return (
      entry.title.toLowerCase().includes(search) ||
      entry.text.toLowerCase().includes(search) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(search))
    );
  });
}

export function useEntries(options: UseEntriesOptions = {}): TimelineEntry[] {
  return (
    useLiveQuery(async () => {
      const entries = await db.entries.toArray();
      return filterEntries(sortEntries(entries), options);
    }, [options.search, options.types?.join('|')], []) ?? []
  );
}
