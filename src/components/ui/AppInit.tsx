'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { requestPermission, replayPending, setBadge } from '@/lib/notifications';
import { sync } from '@/lib/sync';
import { useEntries } from '@/hooks/useEntries';
import { getPendingCount } from '@/core/queries/entry-queries';
import { setActiveLocalUserId } from '@/lib/local-user';

export default function AppInit(): null {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const entries = useEntries();

  useEffect(() => {
    requestPermission();
    replayPending();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    setActiveLocalUserId(isSignedIn ? userId ?? null : null);
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const forceSync = async () => {
        try {
          const { db } = await import('@/db')
          const { claimLegacyRecordsForUser } = await import('@/db/local-ownership')
          if (userId) {
            await claimLegacyRecordsForUser(userId)
          }
          const unsynced = await db.entries
            .filter((e: { syncedAt?: Date | null; ownerUserId?: string | null }) => !e.syncedAt && e.ownerUserId === userId)
            .toArray()
          for (const entry of unsynced) {
            if (entry.id) {
              await db.entries.update(entry.id, {
                updatedAt: entry.updatedAt ?? entry.createdAt,
              })
            }
          }
        } catch {
          // silent fail
        }
        sync()
      }
      forceSync()

      const interval = setInterval(() => {
        if (navigator.onLine) sync()
      }, 60_000)

      return () => clearInterval(interval)
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && isLoaded && isSignedIn) {
        sync()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const pending = getPendingCount(entries);
    setBadge(pending);
  }, [entries]);

  return null;
}
