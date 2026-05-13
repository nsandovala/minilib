import type { TimelineEntry } from '@/types';
import { formatLocalDateKey, addDays } from '@/lib/date';

export function computePriorityScore(
  entry: TimelineEntry,
  pinnedIds: Set<string> = new Set(),
): number {
  if (entry.done) return -200;

  let score = 0;
  const today = formatLocalDateKey(new Date());
  const tomorrow = formatLocalDateKey(addDays(new Date(), 1));
  const nextWeek = formatLocalDateKey(addDays(new Date(), 7));
  const text = `${entry.title} ${entry.text} ${entry.tags.join(' ')}`.toLowerCase();

  if (/\b(urgente|urgencia|ya|inmediato|ahora)\b/.test(text)) score += 100;

  if (entry.date) {
    if (entry.date < today)            score += 100; // overdue
    else if (entry.date === today)     score += 80;
    else if (entry.date === tomorrow)  score += 60;
    else if (entry.date <= nextWeek)   score += 40;
  } else {
    score -= 10;
  }

  if (entry.type === 'payment' && !entry.done)                                             score += 35;
  if (entry.type === 'health' || entry.type === 'appointment' || entry.type === 'pet')    score += 25;
  if (pinnedIds.has(entry.localId))                                                        score += 20;

  return score;
}
