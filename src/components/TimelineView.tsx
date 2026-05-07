'use client';

import type { TimelineEntry, EntryType } from '@/types';
import { toggleEntryDone, deleteEntry } from '@/db/entries';
import { buildTimeline, formatDateLabel } from '@/core/agents/timeline-agent';

interface TimelineViewProps {
  entries: TimelineEntry[];
  onRefresh: () => void;
}

const TYPE_COLORS: Record<EntryType, string> = {
  note: 'var(--text-secondary)',
  task: 'var(--accent-primary)',
  reminder: 'var(--accent-warning)',
  health: 'var(--accent-success)',
  appointment: 'var(--accent-violet)',
  payment: 'var(--accent-human)',
  pet: 'var(--accent-human)',
};

export default function TimelineView({ entries, onRefresh }: TimelineViewProps) {
  const timeline = buildTimeline(entries);

  if (timeline.isEmpty) {
    return (
      <div className="empty-state" style={{ padding: '64px 24px' }}>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
          Tu libreta está vacía
        </p>
        <p style={{ marginTop: '8px', fontSize: '13px' }}>
          Escribe algo arriba para empezar
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 24px 24px' }}>
      {timeline.groups.map((group) => (
        <TimelineGroup
          key={group.key}
          label={group.label}
          entries={group.entries}
          onAction={onRefresh}
        />
      ))}
    </div>
  );
}

interface TimelineGroupProps {
  label: string;
  entries: TimelineEntry[];
  onAction: () => void;
}

function TimelineGroup({ label, entries, onAction }: TimelineGroupProps) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '8px',
          paddingLeft: '4px',
        }}
      >
        {label}
      </h2>
      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <TimelineItem key={entry.id} entry={entry} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

interface TimelineItemProps {
  entry: TimelineEntry;
  onAction: () => void;
}

function TimelineItem({ entry, onAction }: TimelineItemProps) {
  const handleToggle = async () => {
    if (entry.id === undefined) return;
    await toggleEntryDone(entry.id, !entry.done);
    onAction();
  };

  const handleDelete = async () => {
    if (entry.id === undefined) return;
    await deleteEntry(entry.id);
    onAction();
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '11px 13px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        opacity: entry.done ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="tap-target"
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          border: `2px solid ${TYPE_COLORS[entry.type]}`,
          background: entry.done ? TYPE_COLORS[entry.type] : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '1px',
          transition: 'all 0.15s ease',
        }}
        aria-label={entry.done ? 'Marcar pendiente' : 'Marcar completado'}
      >
        {entry.done && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--bg-void)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: TYPE_COLORS[entry.type],
              flexShrink: 0,
            }}
          />
          <p
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              textDecoration: entry.done ? 'line-through' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.title}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {entry.date && (
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              {formatDateLabel(entry.date)}
            </span>
          )}
          {entry.time && (
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              {entry.time}
            </span>
          )}
          <span
            style={{
              fontSize: '10px',
              color: TYPE_COLORS[entry.type],
              textTransform: 'capitalize',
              opacity: 0.78,
            }}
          >
            {entry.type}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: 0.3,
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.3';
        }}
        aria-label="Eliminar"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
