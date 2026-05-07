'use client';

import { useMemo } from 'react';
import { useEntries } from '@/hooks/useEntries';
import { getPendingCount } from '@/core/queries/entry-queries';
import UniversalInput from '@/components/UniversalInput';
import TimelineView from '@/components/TimelineView';

export default function HomePage() {
  const entries = useEntries();
  const pendingCount = useMemo(() => getPendingCount(entries), [entries]);
  const handleRefresh = () => void 0;

  return (
    <div>
      <div style={{ padding: '36px 24px 0' }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Liev
        </h1>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginTop: '4px',
            fontWeight: 400,
          }}
        >
          Una libreta tranquila para lo cotidiano
        </p>
        {pendingCount > 0 && (
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '6px',
              opacity: 0.7,
            }}
          >
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div style={{ marginTop: '16px' }}>
        <UniversalInput onEntryAdded={handleRefresh} />
      </div>

      <TimelineView entries={entries} onRefresh={handleRefresh} />

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
