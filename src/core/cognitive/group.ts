// Pure grouping logic — import type only (erased at runtime), no @/ runtime imports.
// This allows direct Node test imports without tsconfig-paths resolution.
import type { TimelineEntry } from '@/types';

export type CognitiveGroupKey = 'now' | 'today' | 'soon' | 'unscheduled' | 'completed';

export interface CognitiveGroup {
  key: CognitiveGroupKey;
  label: string;
  entries: TimelineEntry[];
}

export interface CognitiveTimelineResult {
  groups: CognitiveGroup[];
  isEmpty: boolean;
}

export type EntrySortFn = (a: TimelineEntry, b: TimelineEntry) => number;

function todayStr(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

// Entries that qualify for "Ahora" among today's items (payment/health/pet/urgent).
function isUrgentForToday(entry: TimelineEntry): boolean {
  if (
    entry.type === 'payment' ||
    entry.type === 'health' ||
    entry.type === 'appointment' ||
    entry.type === 'pet'
  ) return true;
  const text = `${entry.title ?? ''} ${entry.text ?? ''} ${(entry.tags ?? []).join(' ')}`;
  return /\b(urgente|urgencia|ya|inmediato|ahora|importante|prioridad)\b/i.test(text);
}

const newestFirst: EntrySortFn = (a, b) =>
  b.createdAt.getTime() - a.createdAt.getTime();

/**
 * Groups entries into cognitive buckets, then sorts each bucket.
 * Pass a custom sortFn to apply priority-score ordering (used in production).
 * Defaults to newest-first so pure logic is testable without priority-score import.
 */
export function groupEntriesForCognitiveTimeline(
  entries: TimelineEntry[],
  sortFn: EntrySortFn = newestFirst,
): CognitiveTimelineResult {
  if (entries.length === 0) return { groups: [], isEmpty: true };

  const today = todayStr();

  const now: TimelineEntry[] = [];
  const todayNormal: TimelineEntry[] = [];
  const soon: TimelineEntry[] = [];
  const unscheduled: TimelineEntry[] = [];
  const completed: TimelineEntry[] = [];

  for (const entry of entries) {
    if (entry.done) {
      completed.push(entry);
      continue;
    }
    if (!entry.date) {
      unscheduled.push(entry);
      continue;
    }
    if (entry.date < today) {
      // overdue → always "Ahora"
      now.push(entry);
      continue;
    }
    if (entry.date === today) {
      if (isUrgentForToday(entry)) {
        now.push(entry);
      } else {
        todayNormal.push(entry);
      }
      continue;
    }
    // future date
    soon.push(entry);
  }

  now.sort(sortFn);
  todayNormal.sort(sortFn);
  soon.sort(sortFn);
  unscheduled.sort(sortFn);
  completed.sort((a, b) => {
    const bT = b.updatedAt instanceof Date ? b.updatedAt.getTime() : b.createdAt.getTime();
    const aT = a.updatedAt instanceof Date ? a.updatedAt.getTime() : a.createdAt.getTime();
    return bT - aT;
  });

  const groups: CognitiveGroup[] = [];
  if (now.length > 0)         groups.push({ key: 'now',         label: 'Ahora',          entries: now });
  if (todayNormal.length > 0) groups.push({ key: 'today',       label: 'Hoy',            entries: todayNormal });
  if (soon.length > 0)        groups.push({ key: 'soon',        label: 'Próximos días',   entries: soon });
  if (unscheduled.length > 0) groups.push({ key: 'unscheduled', label: 'Sin fecha',       entries: unscheduled });
  if (completed.length > 0)   groups.push({ key: 'completed',   label: 'Completado',      entries: completed });

  return { groups, isEmpty: groups.length === 0 };
}

export function getMicrocopy(entry: TimelineEntry): string | null {
  if (entry.done) return null;
  const today = todayStr();
  const overdue = !!entry.date && entry.date < today;
  const isToday = entry.date === today;
  if (overdue) return 'vencido · actuar ahora';
  if (isToday && entry.type === 'payment') return 'vence hoy';
  if (entry.type === 'payment') return 'pago pendiente';
  if (isToday && (entry.type === 'health' || entry.type === 'appointment')) return 'próximo evento';
  if (isToday && entry.type === 'pet') return 'pendiente hoy';
  return null;
}
