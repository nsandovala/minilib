'use client';

import { useEffect } from 'react';
import { requestPermission, replayPending } from '@/lib/notifications';

export default function AppInit(): null {
  useEffect(() => {
    requestPermission();
    replayPending();
  }, []);

  return null;
}
