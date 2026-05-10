import type { TimelineEntry } from '@/types';
import { formatLocalDateKey, addDays } from '@/lib/date';

export interface TimelineGroup {
  label: string;
  entries: TimelineEntry[];
  key: 'today' | 'upcoming' | 'undated';
}

export interface TimelineResult {
  groups: TimelineGroup[];
  isEmpty: boolean;
}

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrowStr) return 'Mañana';

  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

type PriorityScore = 0 | 1 | 2; // normal < important < urgent

function getTimelinePriority(entry: TimelineEntry): PriorityScore {
  const text = `${entry.title} ${entry.text} ${entry.tags.join(' ')}`.toLowerCase();
  const today = formatLocalDateKey(new Date());
  const tomorrow = formatLocalDateKey(addDays(new Date(), 1));
  const inTwoDays = formatLocalDateKey(addDays(new Date(), 2));

  if (entry.done) return 0;

  if (
    (!!entry.date && entry.date < today) ||
    /\b(urgente|urgencia|ya|inmediato|ahora)\b/.test(text)
  ) {
    return 2;
  }

  if (!entry.done && entry.date && (entry.date === today || entry.date === tomorrow)) {
    return 2;
  }

  if (
    /\b(importante|prioridad|pronto)\b/.test(text) ||
    (!entry.done && entry.date && entry.date <= inTwoDays) ||
    (entry.type === 'payment' && !entry.done && typeof entry.amount === 'number' && entry.amount >= 50000)
  ) {
    return 1;
  }

  return 0;
}

function compareEntries(
  a: TimelineEntry,
  b: TimelineEntry,
  pinnedIds: Set<string>,
): number {
  // 1. Done last
  if (a.done !== b.done) return a.done ? 1 : -1;

  // 2. Pinned first
  const aPinned = pinnedIds.has(a.localId);
  const bPinned = pinnedIds.has(b.localId);
  if (aPinned !== bPinned) return aPinned ? -1 : 1;

  // 3. Urgent > important > normal
  const aPriority = getTimelinePriority(a);
  const bPriority = getTimelinePriority(b);
  if (aPriority !== bPriority) return bPriority - aPriority;

  // 4. Date ascending (earlier first)
  if (a.date && b.date) {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
  } else if (a.date) {
    return -1;
  } else if (b.date) {
    return 1;
  }

  // 5. Time ascending
  if (a.time && b.time) {
    const timeCompare = a.time.localeCompare(b.time);
    if (timeCompare !== 0) return timeCompare;
  } else if (a.time) {
    return -1;
  } else if (b.time) {
    return 1;
  }

  // 6. Fallback: updatedAt desc (most recently touched first)
  const aTime = (a.updatedAt ?? a.createdAt).getTime();
  const bTime = (b.updatedAt ?? b.createdAt).getTime();
  return bTime - aTime;
}

export function buildTimeline(
  entries: TimelineEntry[],
  pinnedIds?: Set<string>,
): TimelineResult {
  if (entries.length === 0) {
    return { groups: [], isEmpty: true };
  }

  const today: TimelineEntry[] = [];
  const upcoming: TimelineEntry[] = [];
  const undated: TimelineEntry[] = [];

  const todayStr = new Date().toISOString().split('T')[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  for (const entry of entries) {
    if (!entry.date) {
      undated.push(entry);
    } else if (entry.date === todayStr) {
      today.push(entry);
    } else if (entry.date <= nextWeekStr) {
      upcoming.push(entry);
    } else {
      undated.push(entry);
    }
  }

  const pins = pinnedIds ?? new Set<string>();

  today.sort((a, b) => compareEntries(a, b, pins));
  upcoming.sort((a, b) => compareEntries(a, b, pins));
  undated.sort((a, b) => compareEntries(a, b, pins));

  const groups: TimelineGroup[] = [];
  if (today.length > 0) groups.push({ label: 'Hoy', entries: today, key: 'today' });
  if (upcoming.length > 0)
    groups.push({ label: 'Próximos días', entries: upcoming, key: 'upcoming' });
  if (undated.length > 0)
    groups.push({ label: 'Sin fecha', entries: undated, key: 'undated' });

  return { groups, isEmpty: false };
}

export { formatDateLabel };
