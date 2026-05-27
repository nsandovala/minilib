import type { TimelineEntry, EntryType } from '@/types';
import { shouldShowOnSurface } from '../display/surface-resolver.ts';

export interface QueryFilter {
  type?: EntryType;
  done?: boolean;
  tag?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasExplicitExpenseMetadata(entry: TimelineEntry): boolean {
  const metadata = entry.metadata as Record<string, unknown> | null | undefined;
  const direction = typeof metadata?.direction === 'string' ? normalizeText(metadata.direction) : '';
  const kind = typeof metadata?.kind === 'string' ? normalizeText(metadata.kind) : '';
  const status = typeof metadata?.status === 'string' ? normalizeText(metadata.status) : '';
  return direction === 'expense' || kind === 'expense' || kind === 'payment' || status === 'paid';
}

function hasExplicitIncomeMetadata(entry: TimelineEntry): boolean {
  const metadata = entry.metadata as Record<string, unknown> | null | undefined;
  const direction = typeof metadata?.direction === 'string' ? normalizeText(metadata.direction) : '';
  const kind = typeof metadata?.kind === 'string' ? normalizeText(metadata.kind) : '';
  return direction === 'income' || kind === 'income';
}

function hasExplicitExpenseTag(entry: TimelineEntry): boolean {
  return entry.tags.some((tag) => {
    const normalized = normalizeText(tag);
    return normalized === 'payment' || normalized === 'expense' || normalized === 'purchase';
  });
}

function hasExplicitIncomeTag(entry: TimelineEntry): boolean {
  return entry.tags.some((tag) => normalizeText(tag) === 'income');
}

function isFinancialIncomeEntry(entry: TimelineEntry): boolean {
  if (typeof entry.amount !== 'number' || Number.isNaN(entry.amount) || entry.amount <= 0) return false;
  return hasExplicitIncomeTag(entry) || hasExplicitIncomeMetadata(entry);
}

function isFinancialExpenseEntry(entry: TimelineEntry): boolean {
  if (typeof entry.amount !== 'number' || Number.isNaN(entry.amount) || entry.amount <= 0) return false;
  if (entry.type === 'payment') return !isFinancialIncomeEntry(entry);
  return hasExplicitExpenseTag(entry) || hasExplicitExpenseMetadata(entry);
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
  return entries.filter((entry) => shouldShowOnSurface(entry, 'purchases'));
}

export function getPaymentEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry) => entry.type === 'payment');
}

export function getHealthEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry) => shouldShowOnSurface(entry, 'health'));
}

export function getPetEntries(entries: TimelineEntry[]): TimelineEntry[] {
  // Use surface resolver to guard against long-form notes that merely mention pet keywords.
  // Legacy entries with wrong type are handled at display layer; data is never mutated.
  return entries.filter((entry) => shouldShowOnSurface(entry, 'pets'));
}

export function getNoteEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry) => shouldShowOnSurface(entry, 'notes'));
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
    getTodayEntries(entries).filter((entry) => isFinancialExpenseEntry(entry))
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
