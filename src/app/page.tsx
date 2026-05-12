'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAuth, UserButton } from '@clerk/nextjs';
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
import LiveClock from '@/components/ui/LiveClock';
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

function DailySummary({ entries }: { entries: TimelineEntry[] }) {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekKey = nextWeek.toISOString().split('T')[0];

  const todayCount = entries.filter((entry) => entry.date === today && !entry.done).length;
  const nextDaysCount = entries.filter((entry) => !!entry.date && entry.date > today && entry.date <= nextWeekKey && !entry.done).length;
  const noDateCount = entries.filter((entry) => !entry.date && !entry.done).length;

  return (
    <div
      className="glass-card"
      style={{
        margin: '14px 20px 0',
        padding: '12px 14px',
        borderRadius: '18px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '10px',
      }}
    >
      <SummaryCell label="Hoy" value={todayCount} />
      <SummaryCell label="Próximos días" value={nextDaysCount} />
      <SummaryCell label="Sin fecha" value={noDateCount} />
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600 }}>
        {value}
      </p>
    </div>
  );
}

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
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

  if (!isLoaded) {
    return (
      <div style={{ minHeight: '100vh', padding: '36px 24px 0' }}>
        <div
          className="glass-card"
          style={{
            maxWidth: '520px',
            margin: '0 auto',
            padding: '28px 24px',
            opacity: 0.7,
          }}
        >
          <div style={{ width: '84px', height: '14px', borderRadius: '999px', background: 'rgba(255,248,240,0.08)' }} />
          <div style={{ width: '220px', height: '12px', borderRadius: '999px', background: 'rgba(255,248,240,0.06)', marginTop: '12px' }} />
          <div style={{ width: '180px', height: '12px', borderRadius: '999px', background: 'rgba(255,248,240,0.05)', marginTop: '8px' }} />
          <div style={{ width: '96px', height: '38px', borderRadius: '14px', background: 'rgba(201,168,130,0.14)', marginTop: '24px' }} />
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div style={{ minHeight: '100vh', padding: '36px 24px 32px' }}>
        <div
          style={{
            minHeight: 'calc(100vh - 68px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '34px 28px 30px',
              borderRadius: '30px',
              background: `
                radial-gradient(circle at top left, rgba(201,168,130,0.12), transparent 42%),
                linear-gradient(145deg, rgba(255,248,240,0.08), rgba(201,168,130,0.05))
              `,
              boxShadow: '0 22px 56px rgba(17,16,15,0.18)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '16px',
                background: 'linear-gradient(180deg, rgba(201,168,130,0.24), rgba(255,248,240,0.06))',
                border: '1px solid rgba(255,248,240,0.09)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '999px',
                  background: 'rgba(201,168,130,0.88)',
                }}
              />
            </div>
            <p
              style={{
                margin: '18px 0 0',
                fontSize: '30px',
                fontWeight: 600,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
              }}
            >
              Liev
            </p>
            <p
              style={{
                margin: '9px 0 0',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Una libreta tranquila para lo cotidiano.
            </p>
            <p
              style={{
                margin: '12px 0 0',
                fontSize: '15px',
                color: 'var(--text-primary)',
                lineHeight: 1.55,
                letterSpacing: '-0.01em',
              }}
            >
              Anota desordenado. Liev lo ordena por ti.
            </p>
            <p
              style={{
                margin: '10px 0 0',
                fontSize: '13px',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
              }}
            >
              Pagos, compras, salud, casa, mascotas y calendario en un solo lugar.
            </p>

            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Link
                href="/sign-in"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '118px',
                  height: '44px',
                  padding: '0 20px',
                  borderRadius: '14px',
                  background: 'var(--accent-human)',
                  color: 'var(--bg-void)',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 12px 28px rgba(201,168,130,0.18)',
                }}
              >
                Entrar
              </Link>
            </div>

            <div
              style={{
                marginTop: '22px',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              {[
                'pagar internet viernes 29990',
                'comprar cilantro mañana',
                'pastilla Luna lunes 9am',
              ].map((example) => (
                <span
                  key={example}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: 'rgba(255,248,240,0.04)',
                    border: '1px solid rgba(255,248,240,0.07)',
                  }}
                >
                  {example}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: '36px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LiveClock />
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                userButtonAvatarBox: 'size-8',
              },
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: '18px' }}>
        <UniversalInput onEntryAdded={handleRefresh} />
      </div>

      <DailySummary entries={entries} />

      <div
        className="chips-scroll"
        style={{
          display: 'flex',
          gap: '6px',
          padding: '12px 20px 0',
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

      {showCalendar && <MiniCalendar entries={entries} />}

      <TimelineView entries={filteredEntries} onRefresh={handleRefresh} />

      <style jsx global>{`
        .chips-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
