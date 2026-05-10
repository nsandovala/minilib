import Dexie, { Table } from 'dexie';
import {
  Drawing,
  Medication,
  Todo,
  Appointment,
  ScheduledNotification,
  TimelineEntry,
  ChecklistItem,
} from '@/types';

export class MiniLibDB extends Dexie {
  drawings!: Table<Drawing>;
  medications!: Table<Medication>;
  todos!: Table<Todo>;
  appointments!: Table<Appointment>;
  scheduled_notifications!: Table<ScheduledNotification>;
  entries!: Table<TimelineEntry>;
  checklist_items!: Table<ChecklistItem>;

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

    // v3: adds localId (UUID) and syncedAt for cloud sync
    this.version(3)
      .stores({
        notes: '++id, updatedAt',
        drawings: '++id, createdAt',
        medications: '++id, active, name',
        todos: '++id, done, category, createdAt',
        appointments: '++id, date, reminded',
        scheduled_notifications: '++id, notifId, scheduledAt, fired',
        entries: '++id, &localId, type, date, done, createdAt, syncedAt',
      })
      .upgrade((tx) => {
        return tx.table('entries').toCollection().modify((entry: Record<string, unknown>) => {
          if (!entry['localId']) {
            entry['localId'] = crypto.randomUUID();
          }
          if (!('syncedAt' in entry)) {
            entry['syncedAt'] = null;
          }
        });
      });

    this.version(4)
      .stores({
        notes: '++id, updatedAt',
        drawings: '++id, createdAt',
        medications: '++id, active, name',
        todos: '++id, done, category, createdAt',
        appointments: '++id, date, reminded',
        scheduled_notifications: '++id, notifId, scheduledAt, fired',
        entries: '++id, &localId, type, date, done, createdAt, syncedAt',
      })
      .upgrade((tx) => {
        return tx.table('entries').toCollection().modify((entry: Record<string, unknown>) => {
          if (!('checklistItems' in entry)) entry['checklistItems'] = null;
          if (!('listItems' in entry)) entry['listItems'] = null;
          if (!('listGroups' in entry)) entry['listGroups'] = null;
          if (!('detectedTags' in entry)) entry['detectedTags'] = null;
        });
      });

    // v5: structured checklist_items table — seeds from existing entry.checklistItems
    this.version(5)
      .stores({
        notes: '++id, updatedAt',
        drawings: '++id, createdAt',
        medications: '++id, active, name',
        todos: '++id, done, category, createdAt',
        appointments: '++id, date, reminded',
        scheduled_notifications: '++id, notifId, scheduledAt, fired',
        entries: '++id, &localId, type, date, done, createdAt, syncedAt',
        checklist_items: '++id, &localId, localEntryId, checked, syncedAt',
      })
      .upgrade(async (tx) => {
        const existingEntries = await tx.table('entries').toArray() as Array<Record<string, unknown>>;
        const seedItems: Array<Omit<ChecklistItem, 'id'>> = [];
        const now = new Date();

        for (const entry of existingEntries) {
          const labels = (entry['checklistItems'] ?? entry['listItems']) as string[] | null;
          if (!labels?.length) continue;
          const localEntryId = entry['localId'] as string;
          if (!localEntryId) continue;

          for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            if (label && typeof label === 'string') {
              seedItems.push({
                localId: crypto.randomUUID(),
                localEntryId,
                label,
                checked: false,
                category: null,
                sortOrder: i,
                createdAt: now,
                updatedAt: now,
                syncedAt: null,
                deletedAt: null,
              });
            }
          }
        }

        if (seedItems.length) {
          await tx.table('checklist_items').bulkAdd(seedItems);
        }
      });

    // v6: adds updatedAt index + sortOrder/deletedAt fields to checklist_items
    this.version(6)
      .stores({
        notes: '++id, updatedAt',
        drawings: '++id, createdAt',
        medications: '++id, active, name',
        todos: '++id, done, category, createdAt',
        appointments: '++id, date, reminded',
        scheduled_notifications: '++id, notifId, scheduledAt, fired',
        entries: '++id, &localId, type, date, done, createdAt, syncedAt',
        checklist_items: '++id, &localId, localEntryId, checked, updatedAt, syncedAt',
      })
      .upgrade((tx) => {
        return tx.table('checklist_items').toCollection().modify((item: Record<string, unknown>) => {
          if (!('sortOrder' in item)) item['sortOrder'] = 0;
          if (!('deletedAt' in item))  item['deletedAt'] = null;
        });
      });
  }
}

export const db = new MiniLibDB();
