'use client';

import type { TimelineEntry, EntryType } from '@/types';
import { toggleEntryDone, deleteEntry } from '@/db/entries';
import { buildTimeline } from '@/core/agents/timeline-agent';

interface TimelineViewProps {
  entries: TimelineEntry[];
  onRefresh: () => void;
}

const TYPE_COLORS: Record<EntryType, string> = {
  payment:     '#c9a882',
  health:      '#7a9e7e',
  appointment: '#b09ab8',
  reminder:    '#b8944e',
  task:        'rgba(245,240,235,0.4)',
  pet:         '#c9a882',
  note:        'rgba(245,240,235,0.3)',
};

const TYPE_LABELS: Record<EntryType, string> = {
  payment:     'pago',
  health:      'salud',
  appointment: 'cita',
  reminder:    'recordatorio',
  task:        'tarea',
  pet:         'mascota',
  note:        'nota',
};

function formatDateShort(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (dateStr === today) return 'hoy';
  if (dateStr === tomorrowStr) return 'mañana';

  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
  return color;
}

export default function TimelineView({ entries, onRefresh }: TimelineViewProps) {
  const timeline = buildTimeline(entries);

  if (timeline.isEmpty) {
    return (
      <div className="empty-state" style={{ padding: '40px 24px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Tu libreta está vacía
        </p>
        <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Escribe algo arriba para empezar
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 20px 20px' }}>
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
    <div style={{ marginBottom: '16px' }}>
      <h2
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '6px',
          paddingLeft: '4px',
        }}
      >
        {label}
      </h2>
      <div className="flex flex-col gap-1.5">
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

  const color = TYPE_COLORS[entry.type];
  const label = TYPE_LABELS[entry.type];
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !entry.done && !!entry.date && entry.date < today;

  const hasContext =
    typeof entry.amount === 'number' ||
    !!entry.time ||
    (!!entry.date && entry.date !== today) ||
    isOverdue;

  return (
    <div
      className="glass-card"
      style={{
        padding: '11px 14px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        opacity: entry.done ? 0.38 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={handleToggle}
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: `1.5px solid ${entry.done ? 'var(--accent-human)' : 'var(--glass-border)'}`,
          background: entry.done ? 'var(--accent-human)' : 'transparent',
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
            width="10"
            height="10"
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

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: type badge + title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: hasContext ? '4px' : 0,
          }}
        >
          <span
            style={{
              fontSize: '10px',
              padding: '1px 7px',
              borderRadius: '10px',
              border: `1px solid ${withAlpha(color, 0.2)}`,
              background: withAlpha(color, 0.08),
              color,
              marginRight: '6px',
              flexShrink: 0,
              lineHeight: 1.6,
            }}
          >
            {label}
          </span>
          <p
            style={{
              flex: 1,
              fontSize: '13px',
              fontWeight: entry.done ? 400 : 500,
              color: entry.done ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: entry.done ? 'line-through' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {entry.title}
          </p>
        </div>

        {/* Row 2: context — amount, time, date, overdue */}
        {hasContext && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {typeof entry.amount === 'number' && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#c9a882',
                }}
              >
                {formatAmount(entry.amount)}
              </span>
            )}

            {entry.time && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={entry.type === 'health' ? '#7a9e7e' : 'var(--text-muted)'}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: entry.type === 'health' ? '#7a9e7e' : 'var(--text-muted)',
                  }}
                >
                  {entry.time}
                </span>
              </span>
            )}

            {entry.date && entry.date !== today && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                }}
              >
                {formatDateShort(entry.date)}
              </span>
            )}

            {isOverdue && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#c47070',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '10px', color: '#c47070' }}>vencido</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={handleDelete}
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '5px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: 0.2,
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.2'; }}
        aria-label="Eliminar"
      >
        <svg
          width="12"
          height="12"
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
