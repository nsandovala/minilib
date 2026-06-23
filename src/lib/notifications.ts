'use client';

import { db } from '@/db';

const MAX_TIMEOUT = 2_000_000_000; // ~23 días: límite seguro de setTimeout
const CATCHUP_CUTOFF_MS = 24 * 60 * 60 * 1000; // no notificar vencidos de +24h
const MAX_CATCHUP = 3;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function armTimer(notifId: string, msUntil: number): void {
  const existing = timers.get(notifId);
  if (existing) {
    clearTimeout(existing); // re-schedule no duplica
    timers.delete(notifId);
  }
  if (msUntil > 0 && msUntil <= MAX_TIMEOUT) {
    timers.set(notifId, setTimeout(() => { void fireIfPending(notifId); }, msUntil));
  }
}

async function fireIfPending(notifId: string): Promise<void> {
  const rec = await db.scheduled_notifications.where('notifId').equals(notifId).first();
  if (!rec || rec.fired) {
    timers.delete(notifId);
    return;
  }
  await showNotification(rec.title, rec.body);
  if (rec.id !== undefined) await db.scheduled_notifications.update(rec.id, { fired: true });
  timers.delete(notifId);
}

export async function requestPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function showNotification(title: string, body: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const opts = { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' };

  // iOS (y navegadores modernos): la notificación DEBE salir por el service worker.
  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, opts);
        return;
      }
    } catch {
      // cae a los fallbacks
    }
  }

  // Desktop sin SW activo: constructor clásico.
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, opts);
      return;
    } catch {
      // iOS no soporta el constructor → cae al banner in-app
    }
  }

  // Sin permiso o sin soporte: banner in-app.
  window.dispatchEvent(new CustomEvent('minilib:notify', { detail: { title, body } }));
}

export async function scheduleNotification(opts: {
  id: string;
  title: string;
  body: string;
  scheduledAt: Date;
}): Promise<void> {
  const msUntil = opts.scheduledAt.getTime() - Date.now();

  const existing = await db.scheduled_notifications
    .where('notifId')
    .equals(opts.id)
    .first();

  if (existing?.id !== undefined) {
    await db.scheduled_notifications.update(existing.id, {
      title: opts.title,
      body: opts.body,
      scheduledAt: opts.scheduledAt,
      fired: false,
    });
  } else {
    await db.scheduled_notifications.add({
      notifId: opts.id,
      title: opts.title,
      body: opts.body,
      scheduledAt: opts.scheduledAt,
      fired: false,
    });
  }

  armTimer(opts.id, msUntil);
}

export async function cancelNotification(notifId: string): Promise<void> {
  const t = timers.get(notifId);
  if (t) {
    clearTimeout(t);
    timers.delete(notifId);
  }
  await db.scheduled_notifications
    .where('notifId')
    .equals(notifId)
    .modify({ fired: true });
}

export async function replayPending(): Promise<void> {
  const now = Date.now();
  const all = await db.scheduled_notifications.toArray();
  const due = all
    .filter((n) => !n.fired && n.scheduledAt.getTime() <= now && now - n.scheduledAt.getTime() <= CATCHUP_CUTOFF_MS)
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
    .slice(0, MAX_CATCHUP);
  for (const n of due) {
    await showNotification(n.title, n.body);
    if (n.id !== undefined) await db.scheduled_notifications.update(n.id, { fired: true });
  }
  // Vencidos muy viejos: marcar fired sin notificar (evita que se acumulen para siempre)
  for (const n of all) {
    if (!n.fired && now - n.scheduledAt.getTime() > CATCHUP_CUTOFF_MS && n.id !== undefined) {
      await db.scheduled_notifications.update(n.id, { fired: true });
    }
  }
}

export async function rearmUpcoming(): Promise<void> {
  const now = Date.now();
  const all = await db.scheduled_notifications.toArray();
  for (const n of all) {
    if (n.fired) continue;
    const msUntil = n.scheduledAt.getTime() - now;
    armTimer(n.notifId, msUntil);
  }
}

export async function setBadge(count: number): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('setAppBadge' in navigator) {
      await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
    }
  } catch {
    // silent fail
  }
}

export async function clearBadge(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('clearAppBadge' in navigator) {
      await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
    }
  } catch {
    // silent fail
  }
}
