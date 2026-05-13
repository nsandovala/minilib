'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { requestPermission, replayPending, setBadge } from '@/lib/notifications';
import { sync } from '@/lib/sync';
import { useEntries } from '@/hooks/useEntries';
import { getPendingCount } from '@/core/queries/entry-queries';

export default function AppInit(): null {
  const { isSignedIn, isLoaded } = useAuth();
  const entries = useEntries();

  useEffect(() => {
    requestPermission();
    replayPending();
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const forceSync = async () => {
        try {
          const { db } = await import('@/db')
          const unsynced = await db.entries
            .filter((e: { syncedAt?: Date | null }) => !e.syncedAt)
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
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const pending = getPendingCount(entries);
    setBadge(pending);
  }, [entries]);

  return null;
}
