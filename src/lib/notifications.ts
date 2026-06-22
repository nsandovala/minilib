'use client';

import { db } from '@/db';

const MAX_TIMEOUT = 2_000_000_000; // ~23 días: límite seguro de setTimeout

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

  if (msUntil > 0 && msUntil <= MAX_TIMEOUT) {
    setTimeout(() => {
      showNotification(opts.title, opts.body);
      db.scheduled_notifications
        .where('notifId')
        .equals(opts.id)
        .modify({ fired: true });
    }, msUntil);
  }

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
}

export async function cancelNotification(id: string): Promise<void> {
  await db.scheduled_notifications
    .where('notifId')
    .equals(id)
    .modify({ fired: true });
}

export async function replayPending(): Promise<void> {
  const now = new Date();
  const all = await db.scheduled_notifications.toArray(); // tabla chica, filtrado en memoria
  for (const n of all) {
    if (!n.fired && n.scheduledAt <= now) {
      showNotification(n.title, n.body);
      if (n.id !== undefined) {
        await db.scheduled_notifications.update(n.id, { fired: true });
      }
    }
  }
}

export async function rearmUpcoming(): Promise<void> {
  const now = Date.now();
  const all = await db.scheduled_notifications.toArray();
  for (const n of all) {
    if (n.fired) continue;
    const msUntil = n.scheduledAt.getTime() - now;
    if (msUntil > 0 && msUntil <= MAX_TIMEOUT) {
      setTimeout(() => {
        showNotification(n.title, n.body);
        if (n.id !== undefined) db.scheduled_notifications.update(n.id, { fired: true });
      }, msUntil);
    }
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
