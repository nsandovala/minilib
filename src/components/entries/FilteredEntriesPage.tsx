'use client';

import { useMemo, useState } from 'react';
import TimelineView from '@/components/TimelineView';
import { useEntries } from '@/hooks/useEntries';
import { getPendingCount, getTotalAmount, queryEntries } from '@/core/queries/entry-queries';
import type { QueryFilter } from '@/core/queries/entry-queries';
import type { TimelineEntry } from '@/types';

interface FilteredEntriesPageProps {
  title: string;
  emptyLabel: string;
  emptyHint: string;
  searchPlaceholder: string;
  description: string;
  filter: (entries: TimelineEntry[]) => TimelineEntry[];
  searchFilter?: Omit<QueryFilter, 'search'>;
}

export default function FilteredEntriesPage({
  title,
  emptyLabel,
  emptyHint,
  searchPlaceholder,
  description,
  filter,
  searchFilter,
}: FilteredEntriesPageProps) {
  const [search, setSearch] = useState('');
  const entries = useEntries();
  const filteredEntries = useMemo(() => {
    const baseEntries = filter(entries);
    return queryEntries(baseEntries, { ...searchFilter, search });
  }, [entries, filter, search, searchFilter]);

  const subtitle = useMemo(() => {
    if (filteredEntries.length === 0) return emptyLabel;
    return `${filteredEntries.length} elemento${filteredEntries.length === 1 ? '' : 's'}`;
  }, [filteredEntries.length, emptyLabel]);

  const totalAmount = useMemo(() => getTotalAmount(filteredEntries), [filteredEntries]);
  const pendingCount = useMemo(() => getPendingCount(filteredEntries), [filteredEntries]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
      </div>

      <div style={{ padding: '0 20px 12px' }}>
        <p
          style={{
            fontSize: '12px',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            marginBottom: '10px',
            maxWidth: '34ch',
          }}
        >
          {description}
        </p>
        {(pendingCount > 0 || totalAmount > 0) && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            {pendingCount > 0 && (
              <span className="chip" style={{ fontSize: '10px', padding: '3px 8px' }}>
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
            {totalAmount > 0 && (
              <span
                className="chip"
                style={{
                  fontSize: '10px',
                  padding: '3px 8px',
                  color: 'var(--accent-human)',
                  borderColor: 'rgba(201, 168, 130, 0.18)',
                }}
              >
                ${totalAmount.toLocaleString('es-CL')}
              </span>
            )}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              left: '12px',
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
            style={{ paddingLeft: '36px', fontSize: '13px', padding: '9px 12px 9px 36px' }}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="empty-state" style={{ margin: '0 20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{emptyLabel}</p>
          <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>{emptyHint}</p>
        </div>
      ) : (
        <TimelineView entries={filteredEntries} onRefresh={() => void 0} />
      )}
    </div>
  );
}
