import type { TimelineEntry } from '@/types';

export interface TimelineGroup {
  label: string;
  entries: TimelineEntry[];
  key: 'today' | 'upcoming' | 'undated';
}

export interface TimelineResult {
  groups: TimelineGroup[];
  isEmpty: boolean;
}

export function groupEntries(entries: TimelineEntry[]): TimelineResult {
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

  today.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  upcoming.sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (a.time || '').localeCompare(b.time || '');
  });

  const groups: TimelineGroup[] = [];
  if (today.length > 0) groups.push({ label: 'Hoy', entries: today, key: 'today' });
  if (upcoming.length > 0)
    groups.push({ label: 'Próximos días', entries: upcoming, key: 'upcoming' });
  if (undated.length > 0)
    groups.push({ label: 'Sin fecha', entries: undated, key: 'undated' });

  return { groups, isEmpty: false };
}

export function formatDateLabel(dateStr: string): string {
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
