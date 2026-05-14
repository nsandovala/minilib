'use client';

import dynamic from 'next/dynamic';

const DebugPanel = dynamic(
  () => import('@/components/ui/DebugPanel'),
  { ssr: false }
);

export default function DebugPanelGate(): JSX.Element | null {
  const showDebug =
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_SHOW_DEBUG === 'true';

  if (!showDebug) {
    return null;
  }

  return <DebugPanel />;
}
