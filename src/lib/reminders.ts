import type { EntryType } from '@/types';
import { scheduleNotification } from '@/lib/notifications';

// Tipos de entry que merecen recordatorio. Notas y shopping_list NO.
const REMINDABLE: EntryType[] = ['appointment', 'health', 'payment', 'task', 'reminder'];

/** Combina date 'YYYY-MM-DD' + time 'HH:MM' (default 09:00) en un Date LOCAL. */
export function buildScheduledAt(date: string, time: string | null): Date | null {
  const t = time && /^\d{1,2}:\d{2}/.test(time) ? time : '09:00';
  const d = new Date(`${date}T${t}`); // sin 'Z' = hora local (Chile)
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function maybeScheduleReminder(e: {
  localId: string;
  type: EntryType;
  title: string;
  text: string;
  date: string | null;
  time: string | null;
}): Promise<void> {
  if (!REMINDABLE.includes(e.type)) return;
  if (!e.date) return;
  const scheduledAt = buildScheduledAt(e.date, e.time);
  if (!scheduledAt || scheduledAt.getTime() <= Date.now()) return; // solo futuro
  await scheduleNotification({
    id: e.localId,
    title: e.title?.trim() || 'Recordatorio',
    body: (e.text || '').slice(0, 120),
    scheduledAt,
  });
}
