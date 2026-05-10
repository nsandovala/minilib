// Serialisable representation used on the wire between client and API routes.
// No Dexie, no drizzle — safe to import on either side.
export interface EntryPayload {
  localId: string;
  text: string;
  type: string;
  title: string;
  date: string | null;
  entryTime: string | null;
  tags: string[];
  done: boolean;
  amount: number | null;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface ChecklistItemPayload {
  localId: string;
  localEntryId: string;
  label: string;
  checked: boolean;
  category: string | null;
  sortOrder: number;
  createdAt: string;  // ISO-8601
  updatedAt: string;  // ISO-8601
  deletedAt: string | null; // ISO-8601 or null
}
