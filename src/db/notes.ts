import { db } from '@/db';
import { Note } from '@/types';

export async function getNotes(): Promise<Note[]> {
  return db.notes.orderBy('updatedAt').reverse().toArray();
}

export async function addNote(data: { title: string; body: string }): Promise<number> {
  const now = new Date();
  return db.notes.add({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateNote(
  id: number,
  data: Partial<Pick<Note, 'title' | 'body'>>
): Promise<void> {
  await db.notes.update(id, {
    ...data,
    updatedAt: new Date(),
  });
}

export async function deleteNote(id: number): Promise<void> {
  await db.notes.delete(id);
}
