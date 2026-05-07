'use client';

import { useCallback } from 'react';
import { useEntries } from '@/hooks/useEntries';
import UniversalInput from '@/components/UniversalInput';
import TimelineView from '@/components/TimelineView';

export default function HomePage() {
  const entries = useEntries();

  const handleRefresh = useCallback(() => {
    void 0;
  }, []);

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: '8px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '28px' }}>
            Liev
          </h1>
          <p className="page-subtitle">Tu libreta viva</p>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
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
