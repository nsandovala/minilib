import Dexie, { Table } from 'dexie';
import {
  Note,
  Drawing,
  Medication,
  Todo,
  Appointment,
  ScheduledNotification,
} from '@/types';

export class MiniLibDB extends Dexie {
  notes!: Table<Note>;
  drawings!: Table<Drawing>;
  medications!: Table<Medication>;
  todos!: Table<Todo>;
  appointments!: Table<Appointment>;
  scheduled_notifications!: Table<ScheduledNotification>;

  constructor() {
    super('MiniLibDB');
    this.version(1).stores({
      notes: '++id, updatedAt',
      drawings: '++id, createdAt',
      medications: '++id, active, name',
      todos: '++id, done, category, createdAt',
      appointments: '++id, date, reminded',
      scheduled_notifications: '++id, notifId, scheduledAt, fired',
    });
  }
}

export const db = new MiniLibDB();
