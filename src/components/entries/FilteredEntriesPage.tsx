'use client';

import { useMemo, useState } from 'react';
import TimelineView from '@/components/TimelineView';
import { useEntries } from '@/hooks/useEntries';
import type { EntryType } from '@/types';

interface FilteredEntriesPageProps {
  title: string;
  emptyLabel: string;
  emptyHint: string;
  searchPlaceholder: string;
  types: EntryType[];
}

export default function FilteredEntriesPage({
  title,
  emptyLabel,
  emptyHint,
  searchPlaceholder,
  types,
}: FilteredEntriesPageProps) {
  const [search, setSearch] = useState('');
  const entries = useEntries({ types, search });

  const subtitle = useMemo(() => {
    if (entries.length === 0) return emptyLabel;
    return `${entries.length} elemento${entries.length === 1 ? '' : 's'}`;
  }, [entries.length, emptyLabel]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input-base"
            style={{ paddingLeft: '40px' }}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state" style={{ margin: '0 24px' }}>
          <p>{emptyLabel}</p>
          <p style={{ marginTop: '8px', fontSize: '13px' }}>{emptyHint}</p>
        </div>
      ) : (
        <TimelineView entries={entries} onRefresh={() => void 0} />
      )}
    </div>
  );
}
