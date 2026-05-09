'use client';

import type { TimelineEntry, EntryType } from '@/types';
import { toggleEntryDone, deleteEntry } from '@/db/entries';
import { buildTimeline } from '@/core/agents/timeline-agent';
import { formatRelativeDate, formatCLP, isOverdue as checkOverdue } from '@/lib/entries';

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
  appointment: 'salud',
  reminder:    'tarea',
  task:        'tarea',
  pet:         'mascota',
  note:        'nota',
};

const GENERIC_TITLE_WORDS = new Set([
  '',
  'comprar',
  'para',
  'pagar',
  'tomar',
  'hacer',
  'nota',
  'recordatorio',
]);

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

function normalizeText(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function isGenericTitle(title: string): boolean {
  const normalized = normalizeText(title).toLowerCase();
  return GENERIC_TITLE_WORDS.has(normalized) || normalized.length <= 2;
}

function looksLikePurchase(entry: TimelineEntry): boolean {
  const haystack = `${entry.title} ${entry.text}`.toLowerCase();
  return /\b(comprar|compra|supermercado|feria|mercado)\b/.test(haystack);
}

function getDisplayType(entry: TimelineEntry): string {
  if (entry.type === 'payment') return TYPE_LABELS.payment;
  if (entry.type === 'health' || entry.type === 'appointment') return TYPE_LABELS[entry.type];
  if (entry.type === 'pet') return TYPE_LABELS.pet;
  if (entry.type === 'note') return TYPE_LABELS.note;
  if (looksLikePurchase(entry)) return 'compra';
  return TYPE_LABELS[entry.type];
}

function getDisplayTitle(entry: TimelineEntry): string {
  const normalizedTitle = normalizeText(entry.title);
  const normalizedText = normalizeText(entry.text);

  if (!normalizedTitle || isGenericTitle(normalizedTitle)) {
    return normalizedText || normalizedTitle || 'Sin contenido';
  }

  return normalizedTitle;
}

function getSecondaryText(entry: TimelineEntry, displayTitle: string): string | null {
  const normalizedText = normalizeText(entry.text);
  if (!normalizedText) return null;

  const normalizedDisplayTitle = normalizeText(displayTitle).toLowerCase();
  const lowerText = normalizedText.toLowerCase();

  if (lowerText === normalizedDisplayTitle) return null;
  if (isGenericTitle(normalizedText)) return null;
  if (normalizedText.length < 5) return null;

  return normalizedText;
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
  const label = getDisplayType(entry);
  const entryIsOverdue = checkOverdue(entry);
  const displayTitle = getDisplayTitle(entry);
  const secondaryText = getSecondaryText(entry, displayTitle);

  // Tags beyond the auto-injected type tag (e.g. 'urgente', 'recurrente')
  const extraTags = entry.tags.filter((t) => t !== entry.type);

  const dateLabel = entry.date ? formatRelativeDate(entry.date) : null;
  const hasMeta =
    !!dateLabel ||
    !!entry.time ||
    typeof entry.amount === 'number' ||
    entryIsOverdue ||
    extraTags.length > 0;

  return (
    <div
      className="glass-card"
      style={{
        padding: '12px 14px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        opacity: entry.done ? 0.55 : 1,
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
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: hasMeta || secondaryText ? '6px' : 0,
          }}
        >
          <span
            style={{
              fontSize: '10px',
              padding: '2px 7px',
              borderRadius: '999px',
              border: `1px solid ${withAlpha(color, 0.2)}`,
              background: withAlpha(color, 0.08),
              color,
              flexShrink: 0,
              lineHeight: 1.5,
              marginTop: '1px',
              textTransform: 'lowercase',
            }}
          >
            {label}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontSize: '13px',
                fontWeight: entry.done ? 400 : 500,
                color: entry.done ? 'var(--text-secondary)' : 'var(--text-primary)',
                textDecoration: entry.done ? 'line-through' : 'none',
                margin: 0,
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              {displayTitle}
            </p>
            {secondaryText && (
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                }}
              >
                {secondaryText}
              </p>
            )}
          </div>
        </div>

        {hasMeta && (
          <div
            style={{
              display: 'flex',
              gap: '7px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {dateLabel && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: entryIsOverdue ? '#c47070' : 'var(--text-secondary)',
                }}
              >
                {dateLabel}
              </span>
            )}

            {entry.time && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: entry.type === 'health' ? '#7a9e7e' : 'var(--text-muted)',
                }}
              >
                {entry.time}
              </span>
            )}

            {typeof entry.amount === 'number' && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#c9a882',
                }}
              >
                {formatCLP(entry.amount)}
              </span>
            )}

            {entryIsOverdue && (
              <span
                style={{
                  fontSize: '10px',
                  color: '#c47070',
                  border: '1px solid rgba(196,112,112,0.25)',
                  background: 'rgba(196,112,112,0.08)',
                  borderRadius: '999px',
                  padding: '2px 7px',
                  lineHeight: 1.4,
                }}
              >
                vencido
              </span>
            )}

            {extraTags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,248,240,0.08)',
                  background: 'rgba(255,248,240,0.04)',
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}
              >
                {tag}
              </span>
            ))}
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
