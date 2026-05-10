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

export interface ChecklistItem {
  id?: number;
  localId: string;            // UUID — stable across sync
  localEntryId: string;       // parent entry's localId
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
}

export interface TimelineEntry {
  id?: number;
  localId: string;       // UUID — stable identifier across sync
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
  syncedAt?: Date | null;
}
