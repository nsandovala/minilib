import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Note } from '@/types';

export function useNotes(): Note[] {
  return useLiveQuery(
    () => db.notes.orderBy('updatedAt').reverse().toArray(),
    [],
    []
  ) ?? [];
}
