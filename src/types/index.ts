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
  | 'pet';

export interface ParsedEntry {
  text: string;
  type: EntryType;
  title: string;
  date?: string;
  time?: string;
  tags: string[];
  amount?: number;
}

export interface TimelineEntry {
  id?: number;
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
}
