'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { requestPermission, replayPending } from '@/lib/notifications';
import { sync } from '@/lib/sync';

export default function AppInit(): null {
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    requestPermission();
    replayPending();
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      sync();
    }
  }, [isLoaded, isSignedIn]);

  return null;
}
