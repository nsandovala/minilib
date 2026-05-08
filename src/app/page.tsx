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

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const pendingPayments = useMemo(
    () => entries.filter((e) => e.type === 'payment' && !e.done).length,
    [entries],
  );

  const todayHealth = useMemo(
    () => entries.filter((e) => e.type === 'health' && e.date === today).length,
    [entries, today],
  );

  const upcomingAppointments = useMemo(
    () => entries.filter((e) => e.type === 'appointment' && !e.done).length,
    [entries],
  );

  const showInsights =
    entries.length > 0 &&
    (pendingPayments > 0 || todayHealth > 0 || upcomingAppointments > 0);

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

      {showInsights && (
        <div
          className="insights-bar"
          style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 20px 0',
            overflowX: 'auto',
          }}
        >
          {pendingPayments > 0 && (
            <span
              className="chip"
              style={{
                borderColor: 'rgba(184,148,78,0.3)',
                color: '#b8944e',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {pendingPayments} pago{pendingPayments !== 1 ? 's' : ''} pendiente{pendingPayments !== 1 ? 's' : ''}
            </span>
          )}
          {todayHealth > 0 && (
            <span
              className="chip"
              style={{
                borderColor: 'rgba(122,158,126,0.3)',
                color: '#7a9e7e',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {todayHealth} medicamento{todayHealth !== 1 ? 's' : ''} hoy
            </span>
          )}
          {upcomingAppointments > 0 && (
            <span
              className="chip"
              style={{
                borderColor: 'rgba(176,154,184,0.3)',
                color: '#b09ab8',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {upcomingAppointments} cita{upcomingAppointments !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <TimelineView entries={entries} onRefresh={handleRefresh} />

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .insights-bar::-webkit-scrollbar {
          display: none;
        }
        .insights-bar {
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
