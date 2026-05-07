import Dexie, { Table } from 'dexie';
import {
  Drawing,
  Medication,
  Todo,
  Appointment,
  ScheduledNotification,
  TimelineEntry,
} from '@/types';

export class MiniLibDB extends Dexie {
  drawings!: Table<Drawing>;
  medications!: Table<Medication>;
  todos!: Table<Todo>;
  appointments!: Table<Appointment>;
  scheduled_notifications!: Table<ScheduledNotification>;
  entries!: Table<TimelineEntry>;

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
    this.version(2).stores({
      notes: '++id, updatedAt',
      drawings: '++id, createdAt',
      medications: '++id, active, name',
      todos: '++id, done, category, createdAt',
      appointments: '++id, date, reminded',
      scheduled_notifications: '++id, notifId, scheduledAt, fired',
      entries: '++id, type, date, done, createdAt',
    });
  }
}

export const db = new MiniLibDB();
