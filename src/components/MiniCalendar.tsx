'use client';

import { useState, useMemo } from 'react';
import type { TimelineEntry } from '@/types';
import { formatCLP } from '@/lib/entries';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const TYPE_COLORS: Record<string, string> = {
  payment:     '#c9a882',
  health:      '#7a9e7e',
  appointment: '#b09ab8',
  reminder:    '#b8944e',
  task:        'rgba(245,240,235,0.45)',
  pet:         '#c9a882',
  note:        'rgba(245,240,235,0.3)',
};

const TYPE_LABELS: Record<string, string> = {
  payment:     'pago',
  health:      'salud',
  appointment: 'cita',
  reminder:    'recordatorio',
  task:        'tarea',
  pet:         'mascota',
  note:        'nota',
};

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

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayKey(): string {
  const d = new Date();
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = (firstDow + 6) % 7;                 // shift to Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface MiniCalendarProps {
  entries: TimelineEntry[];
}

export default function MiniCalendar({ entries }: MiniCalendarProps) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selected,  setSelected]  = useState<string | null>(null);

  const today   = todayKey();
  const grid    = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const entryDates = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) if (e.date) s.add(e.date);
    return s;
  }, [entries]);

  const selectedEntries = useMemo(
    () => (selected ? entries.filter((e) => e.date === selected) : []),
    [entries, selected],
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handleDay = (day: number) => {
    const key = toDateKey(viewYear, viewMonth, day);
    setSelected((prev) => (prev === key ? null : key));
  };

  const selectedLabel = selected
    ? new Date(selected + 'T12:00:00').toLocaleDateString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : null;

  return (
    <div
      style={{
        margin: '10px 20px 0',
        padding: '16px',
        borderRadius: '20px',
        border: '1px solid rgba(255,248,240,0.09)',
        background:
          'linear-gradient(160deg, rgba(255,248,240,0.065) 0%, rgba(201,168,130,0.04) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
      }}
    >
      {/* ── Header ─────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>

        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ label: '‹', action: prevMonth }, { label: '›', action: nextMonth }].map(
            ({ label, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,248,240,0.08)',
                  background: 'rgba(255,248,240,0.04)',
                  color: 'var(--text-secondary)',
                  fontSize: '16px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'opacity 0.12s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* ── Weekday labels ─────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          marginBottom: '4px',
        }}
      >
        {WEEKDAY_LABELS.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              color: 'var(--text-muted)',
              padding: '3px 0',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Day grid ───────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
        }}
      >
        {grid.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} style={{ aspectRatio: '1' }} />;

          const key        = toDateKey(viewYear, viewMonth, day);
          const isToday    = key === today;
          const isSel      = key === selected;
          const hasEntries = entryDates.has(key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleDay(day)}
              style={{
                width: '100%',
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                borderRadius: '8px',
                border: isSel
                  ? '1px solid rgba(201,168,130,0.45)'
                  : isToday
                    ? '1px solid rgba(201,168,130,0.22)'
                    : '1px solid transparent',
                background: isSel
                  ? 'rgba(201,168,130,0.18)'
                  : isToday
                    ? 'rgba(201,168,130,0.08)'
                    : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                outline: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: isSel || isToday ? 600 : 400,
                  color: isSel
                    ? '#c9a882'
                    : isToday
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  lineHeight: 1,
                }}
              >
                {day}
              </span>
              {hasEntries && (
                <span
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: isSel
                      ? '#c9a882'
                      : 'rgba(201,168,130,0.5)',
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Selected-day entries ───────────────── */}
      {selected && (
        <div
          style={{
            marginTop: '14px',
            borderTop: '1px solid rgba(255,248,240,0.07)',
            paddingTop: '12px',
          }}
        >
          {selectedLabel && (
            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginBottom: '8px',
                textTransform: 'capitalize',
              }}
            >
              {selectedLabel}
            </p>
          )}

          {selectedEntries.length === 0 ? (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '10px 0',
              }}
            >
              Sin pendientes para este día
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {selectedEntries.map((entry) => (
                <CalendarEntryRow key={entry.id ?? entry.text} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarEntryRow({ entry }: { entry: TimelineEntry }) {
  const color = TYPE_COLORS[entry.type] ?? 'rgba(245,240,235,0.4)';
  const label = TYPE_LABELS[entry.type] ?? entry.type;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 0',
        borderBottom: '1px solid rgba(255,248,240,0.04)',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          padding: '1px 6px',
          borderRadius: '8px',
          border: `1px solid ${withAlpha(color, 0.22)}`,
          background: withAlpha(color, 0.08),
          color,
          flexShrink: 0,
          lineHeight: 1.6,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>

      <span
        style={{
          flex: 1,
          fontSize: '12px',
          fontWeight: 500,
          color: entry.done ? 'var(--text-muted)' : 'var(--text-secondary)',
          textDecoration: entry.done ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.title}
      </span>

      <div
        style={{
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
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
        {typeof entry.amount === 'number' && (
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#c9a882',
              fontWeight: 600,
            }}
          >
            {formatCLP(entry.amount)}
          </span>
        )}
      </div>
    </div>
  );
}
