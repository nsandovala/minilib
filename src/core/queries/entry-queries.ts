import type { TimelineEntry, EntryType } from '@/types';

export interface QueryFilter {
  type?: EntryType;
  done?: boolean;
  tag?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

const PURCHASE_TERMS = [
  'compr',
  'super',
  'mercado',
  'supermercado',
  'feria',
  'despensa',
  'abarrote',
  'hogar',
  'casa',
  'limpieza',
  'detergente',
  'papel higienico',
  'papel higiénico',
  'market',
  'grocer',
  'verdura',
  'fruta',
];

const PET_TERMS = [
  'mascota',
  'perro',
  'gato',
  'vet',
  'veterinario',
  'vacuna',
  'comida',
  'alimento',
  'correa',
  'arena',
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function entryHaystack(entry: TimelineEntry): string {
  return normalizeText([entry.title, entry.text, ...entry.tags].join(' '));
}

function matchesAnyTerm(entry: TimelineEntry, terms: string[]): boolean {
  const haystack = entryHaystack(entry);
  return terms.some((term) => haystack.includes(normalizeText(term)));
}

export function queryEntries(
  entries: TimelineEntry[],
  filter: QueryFilter
): TimelineEntry[] {
  let result = entries;

  if (filter.type !== undefined) {
    result = result.filter((e) => e.type === filter.type);
  }

  if (filter.done !== undefined) {
    result = result.filter((e) => e.done === filter.done);
  }

  if (filter.tag !== undefined) {
    result = result.filter((e) => e.tags.includes(filter.tag!));
  }

  if (filter.search) {
    const q = filter.search.toLowerCase();
    result = result.filter(
      (e) =>
        e.text.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q)
    );
  }

  if (filter.dateFrom) {
    result = result.filter(
      (e) => e.date && e.date >= filter.dateFrom!
    );
  }

  if (filter.dateTo) {
    result = result.filter(
      (e) => e.date && e.date <= filter.dateTo!
    );
  }

  return result;
}

export function getPurchaseEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry) => {
    if (entry.type === 'shopping_list') return true;
    if (entry.type === 'payment' && matchesAnyTerm(entry, PURCHASE_TERMS)) return true;
    if (entry.type === 'task' && matchesAnyTerm(entry, PURCHASE_TERMS)) return true;
    return false;
  });
}

export function getPaymentEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry) => entry.type === 'payment');
}

export function getHealthEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry) => entry.type === 'health' || entry.type === 'appointment');
}

export function getPetEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry) => entry.type === 'pet' || matchesAnyTerm(entry, PET_TERMS));
}

export function getNoteEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry) => entry.type === 'note');
}

export function getTodayEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const today = new Date().toISOString().split('T')[0];
  return entries.filter((entry) => {
    const createdAt = entry.createdAt.toISOString().split('T')[0];
    return entry.date === today || createdAt === today;
  });
}

export function getTotalAmount(entries: TimelineEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.amount ?? 0), 0);
}

export function getTodaySpend(entries: TimelineEntry[]): number {
  return getTotalAmount(
    getTodayEntries(entries).filter((entry) => {
      const isMoneyEntry = entry.type === 'payment' || entry.type === 'pet' || matchesAnyTerm(entry, PURCHASE_TERMS);
      return isMoneyEntry && typeof entry.amount === 'number';
    })
  );
}

export function countByType(entries: TimelineEntry[]): Record<EntryType, number> {
  const counts: Record<string, number> = {
    note: 0,
    task: 0,
    reminder: 0,
    health: 0,
    appointment: 0,
    payment: 0,
    pet: 0,
    shopping_list: 0,
  };

  for (const entry of entries) {
    counts[entry.type] = (counts[entry.type] || 0) + 1;
  }

  return counts as Record<EntryType, number>;
}

export function getPendingCount(entries: TimelineEntry[]): number {
  return entries.filter((e) => !e.done).length;
}

export function getByType(
  entries: TimelineEntry[],
  type: EntryType
): TimelineEntry[] {
  return entries.filter((e) => e.type === type);
}

export function getOverdue(entries: TimelineEntry[]): TimelineEntry[] {
  const todayStr = new Date().toISOString().split('T')[0];
  return entries.filter(
    (e) => !e.done && e.date && e.date < todayStr
  );
}
