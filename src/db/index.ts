import Dexie, { Table } from 'dexie';
import { Note, Drawing, Medication, Todo, Appointment } from '@/types';

export class MiniLibDB extends Dexie {
  notes!: Table<Note>;
  drawings!: Table<Drawing>;
  medications!: Table<Medication>;
  todos!: Table<Todo>;
  appointments!: Table<Appointment>;

  constructor() {
    super('MiniLibDB');
    this.version(1).stores({
      notes: '++id, updatedAt',
      drawings: '++id, createdAt',
      medications: '++id, active',
      todos: '++id, done, category',
      appointments: '++id, date',
    });
  }
}

export const db = new MiniLibDB();
