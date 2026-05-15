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
          if (!('deletedAt' in item)) item['deletedAt'] = null;
        });
      });

    // v7: adds metadata jsonb-like field to entries for structured shopping lists
    this.version(7)
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
        return tx.table('entries').toCollection().modify((entry: Record<string, unknown>) => {
          if (!('metadata' in entry)) entry['metadata'] = null;
        });
      });

    // v8: scopes local records by Clerk user to avoid cross-user leakage on shared devices
    this.version(8)
      .stores({
        notes: '++id, updatedAt',
        drawings: '++id, createdAt',
        medications: '++id, active, name',
        todos: '++id, done, category, createdAt',
        appointments: '++id, date, reminded',
        scheduled_notifications: '++id, notifId, scheduledAt, fired',
        entries: '++id, &localId, ownerUserId, type, date, done, createdAt, syncedAt',
        checklist_items: '++id, &localId, ownerUserId, localEntryId, checked, updatedAt, syncedAt',
      })
      .upgrade(async (tx) => {
        await tx.table('entries').toCollection().modify((entry: Record<string, unknown>) => {
          if (!('ownerUserId' in entry)) entry['ownerUserId'] = null;
        });

        await tx.table('checklist_items').toCollection().modify((item: Record<string, unknown>) => {
          if (!('ownerUserId' in item)) item['ownerUserId'] = null;
        });
      });
  }
}


function isIndexedDBAvailable(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof indexedDB !== 'undefined' &&
      indexedDB !== null
    );
  } catch {
    return false;
  }
}

function createStubDB(): MiniLibDB {
  const noopArr = async () => [];
  const noopNull = async () => null;
  const noop = async () => { };
  const rangeStub = { filter: () => ({ first: noopNull, toArray: noopArr }), first: noopNull, toArray: noopArr };
  const whereStub = () => ({
    equals:       () => ({ first: noopNull, toArray: noopArr, modify: noop, delete: noop }),
    above:        () => rangeStub,
    aboveOrEqual: () => rangeStub,
    below:        () => rangeStub,
    belowOrEqual: () => rangeStub,
    between:      () => rangeStub,
  });
  const tableStub = {
    toArray: noopArr, add: async () => 0, update: noop, delete: noop,
    put: noop, where: whereStub, filter: () => ({ toArray: noopArr }),
    orderBy: () => ({ reverse: () => ({ toArray: noopArr }), toArray: noopArr }),
    get: noopNull, count: async () => 0, clear: noop, bulkAdd: noop, bulkPut: noop,
  };
  return {
    entries: tableStub, checklist_items: tableStub,
    scheduled_notifications: tableStub, drawings: tableStub,
    medications: tableStub, todos: tableStub, appointments: tableStub,
    transaction: async (_m: string, _t: unknown[], fn: () => Promise<void>) => fn(),
  } as unknown as MiniLibDB;
}

export const db = isIndexedDBAvailable() ? new MiniLibDB() : createStubDB();
