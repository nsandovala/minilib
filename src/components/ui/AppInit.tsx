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
      sync();
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const pending = getPendingCount(entries);
    setBadge(pending);
  }, [entries]);

  return null;
}
