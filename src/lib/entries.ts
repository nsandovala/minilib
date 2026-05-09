import type { TimelineEntry } from '@/types';
import { formatLocalDateKey, addDays } from './date';

export function formatRelativeDate(dateStr: string): string {
  const today = formatLocalDateKey(new Date());
  const tomorrow = formatLocalDateKey(addDays(new Date(), 1));

  if (dateStr === today) return 'hoy';
  if (dateStr === tomorrow) return 'mañana';

  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long' });
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(amount);
}

export function isOverdue(entry: TimelineEntry): boolean {
  if (entry.done || !entry.date) return false;
  return entry.date < formatLocalDateKey(new Date());
}

export function isThisWeek(entry: TimelineEntry): boolean {
  if (!entry.date) return false;
  const today = formatLocalDateKey(new Date());
  const nextWeek = formatLocalDateKey(addDays(new Date(), 7));
  return entry.date >= today && entry.date <= nextWeek;
}

export function getCalendarEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const today = formatLocalDateKey(new Date());
  const nextWeek = formatLocalDateKey(addDays(new Date(), 7));
  return entries.filter((e) => !!e.date && e.date >= today && e.date <= nextWeek);
}
