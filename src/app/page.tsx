'use client';

import { useMemo, useState } from 'react';
import { useEntries } from '@/hooks/useEntries';
import {
  getPendingCount,
  getPurchaseEntries,
  getPaymentEntries,
  getHealthEntries,
  getPetEntries,
} from '@/core/queries/entry-queries';
import UniversalInput from '@/components/UniversalInput';
import TimelineView from '@/components/TimelineView';
import MiniCalendar from '@/components/MiniCalendar';
import type { TimelineEntry } from '@/types';

type ChipFilter = 'all' | 'compra' | 'pago' | 'salud' | 'mascota' | 'casa' | 'calendario';

const CHIPS: { id: ChipFilter; label: string }[] = [
  { id: 'compra',     label: 'Compra' },
  { id: 'pago',       label: 'Pago' },
  { id: 'salud',      label: 'Salud' },
  { id: 'mascota',    label: 'Mascota' },
  { id: 'casa',       label: 'Casa' },
  { id: 'calendario', label: 'Calendario' },
];

function applyChip(entries: TimelineEntry[], chip: ChipFilter): TimelineEntry[] {
  switch (chip) {
    case 'compra':    return getPurchaseEntries(entries);
    case 'pago':      return getPaymentEntries(entries);
    case 'salud':     return getHealthEntries(entries);
    case 'mascota':   return getPetEntries(entries);
    case 'casa':      return entries.filter((e) => e.type === 'task');
    default:          return entries; // 'calendario' and 'all' show everything
  }
}

function CalendarIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function HomePage() {
  const entries = useEntries();
  const [activeChip, setActiveChip] = useState<ChipFilter>('all');

  const filteredEntries = useMemo(
    () => applyChip(entries, activeChip),
    [entries, activeChip],
  );

  const pendingCount = useMemo(() => getPendingCount(entries), [entries]);
  const handleRefresh = () => void 0;

  const toggleChip = (chip: ChipFilter) => {
    setActiveChip((prev) => (prev === chip ? 'all' : chip));
  };

  const showCalendar = activeChip === 'calendario';

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

      {/* ── Filter chips ──────────────────────── */}
      <div
        className="chips-scroll"
        style={{
          display: 'flex',
          gap: '6px',
          padding: '10px 20px 0',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`chip${activeChip === chip.id ? ' active' : ''}`}
            onClick={() => toggleChip(chip.id)}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            {chip.id === 'calendario' && <CalendarIcon />}
            {chip.label}
          </button>
        ))}
      </div>

      {/* ── Mini Calendar (shown when chip active) */}
      {showCalendar && <MiniCalendar entries={entries} />}

      {/* ── Timeline ─────────────────────────── */}
      <TimelineView entries={filteredEntries} onRefresh={handleRefresh} />

      <style jsx global>{`
        .chips-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
