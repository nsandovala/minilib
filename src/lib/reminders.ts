import type { EntryType } from '@/types';
import { scheduleNotification } from '@/lib/notifications';

// Tipos de entry que merecen recordatorio. Notas y shopping_list NO.
const REMINDABLE: EntryType[] = ['appointment', 'health', 'payment', 'task', 'reminder'];

/** Combina date 'YYYY-MM-DD' + time 'HH:MM' (default 09:00) en un Date LOCAL. */
export function buildScheduledAt(date: string, time: string | null): Date | null {
  const raw = time?.trim();
  const t = raw && /^\d{1,2}:\d{2}$/.test(raw) ? raw : '09:00'; // ancla $: rechaza "9:30am"
  const [hh, mm] = t.split(':').map(Number);
  if (hh > 23 || mm > 59) return null; // rechaza "24:00", "23:99"
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
