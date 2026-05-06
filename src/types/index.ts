export interface Note {
  id?: number;
  createdAt: Date;
  title: string;
  body: string;
  updatedAt: Date;
}

export interface Drawing {
  id?: number;
  createdAt: Date;
  title: string;
  imageData: string;
  canvasJSON: string;
}

export interface Medication {
  id?: number;
  createdAt: Date;
  name: string;
  dose: string;
  times: string[];
  withFood: boolean;
  notes?: string;
  active: boolean;
}

export type TodoCategory = 'compras' | 'pendiente' | 'tarea';

export interface Todo {
  id?: number;
  createdAt: Date;
  text: string;
  done: boolean;
  category: TodoCategory;
}

export interface Appointment {
  id?: number;
  createdAt: Date;
  doctor: string;
  specialty?: string;
  date: string;
  time: string;
  location?: string;
  notes?: string;
  reminded: boolean;
}
