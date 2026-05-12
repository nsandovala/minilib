'use client';

import { db } from '@/db';
import { ScheduledNotification } from '@/types';

export async function requestPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showNotification(title: string, body: string): void {
  if (typeof window === 'undefined') return;

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });
  } else {
    window.dispatchEvent(
      new CustomEvent('minilib:notify', {
        detail: { title, body },
      })
    );
  }
}

export async function scheduleNotification(opts: {
  id: string;
  title: string;
  body: string;
  scheduledAt: Date;
}): Promise<void> {
  const msUntil = opts.scheduledAt.getTime() - Date.now();

  if (msUntil > 0) {
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
  const pending = await db.scheduled_notifications
    .where('fired')
    .equals(0)
    .and((n: ScheduledNotification) => n.scheduledAt <= new Date())
    .toArray();

  for (const n of pending) {
    showNotification(n.title, n.body);
    if (n.id !== undefined) {
      await db.scheduled_notifications.update(n.id, { fired: true });
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
