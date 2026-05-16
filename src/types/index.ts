export interface Drawing {
  id?: number;
  title: string;
  imageData: string;
  canvasJSON: string;
  createdAt: Date;
}

export interface Medication {
  id?: number;
  name: string;
  dose: string;
  times: string[];
  withFood: boolean;
  notes?: string;
  active: boolean;
  color: string;
  stock?: number;
  refillAt?: number;
  createdAt: Date;
}

export type TodoCategory = 'canasta' | 'hogar' | 'cuentas';

export interface Todo {
  id?: number;
  text: string;
  done: boolean;
  category: TodoCategory;
  quantity?: string;
  amount?: number;
  dueDate?: string;
  createdAt: Date;
}

export interface Appointment {
  id?: number;
  doctor: string;
  specialty?: string;
  date: string;
  time: string;
  location?: string;
  notes?: string;
  reminded: boolean;
  color: string;
  createdAt: Date;
}

export interface ScheduledNotification {
  id?: number;
  notifId: string;
  title: string;
  body: string;
  scheduledAt: Date;
  fired: boolean;
}

export type EntryType =
  | 'note'
  | 'task'
  | 'reminder'
  | 'health'
  | 'appointment'
  | 'payment'
  | 'pet'
  | 'shopping_list';

export type ShoppingStage = 'pending' | 'shopping' | 'completed';

export type StoreType = 'supermercado' | 'feria' | 'farmacia' | 'otro';

export interface ShoppingItem {
  id: string;
  label: string;
  category: string;
  checked: boolean;
  amount?: number;
  quantity?: string;
  unit?: string;
}

export interface ShoppingProgress {
  total: number;
  checked: number;
  totalEstimated: number;
  totalChecked: number;
}

export interface ShoppingMetadata {
  listKind: 'shopping';
  storeType: StoreType;
  items: ShoppingItem[];
  progress: ShoppingProgress;
}

export type EntryMetadata = ShoppingMetadata | Record<string, unknown>;

export interface ChecklistItem {
  id?: number;
  localId: string;            // UUID — stable across sync
  localEntryId: string;       // parent entry's localId
  ownerUserId?: string | null;
  label: string;
  checked: boolean;
  category: string | null;
  sortOrder: number;          // display order within the list
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date | null;
  deletedAt?: Date | null;    // soft-delete — propagates across sync
}

export interface ParsedEntry {
  text: string;
  type: EntryType;
  title: string;
  date?: string;
  time?: string;
  tags: string[];
  amount?: number;
  checklistItems?: string[];  // seed labels for ChecklistItem records
  listItems?: string[];
  listGroups?: string[];
  detectedTags?: string[];
  metadata?: EntryMetadata;
  confidence?: number;
  reasons?: string[];
}

export interface TimelineEntry {
  id?: number;
  localId: string;       // UUID — stable identifier across sync
  ownerUserId?: string | null;
  text: string;
  type: EntryType;
  title: string;
  date?: string | null;
  time?: string | null;
  tags: string[];
  done: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
  amount?: number | null;
  checklistItems?: string[] | null;  // seed labels (canonical state is in checklist_items table)
  listItems?: string[] | null;
  listGroups?: string[] | null;
  detectedTags?: string[] | null;
  metadata?: EntryMetadata | null;
  syncedAt?: Date | null;
}
