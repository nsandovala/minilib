'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useEntries } from '@/hooks/useEntries';
import { deleteEntry, toggleEntryDone } from '@/db/entries';

const INCOME_KEY = 'liev:monthly-income';

function formatCLP(n: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n);
}

function formatDateShort(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const d2 = new Date(); d2.setDate(d2.getDate() + 1);
  const tomorrow = d2.toISOString().split('T')[0];
  if (dateStr === today) return 'hoy';
  if (dateStr === tomorrow) return 'mañ.';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' });
}

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [income, setIncome] = useState(0);
  const [incomeRaw, setIncomeRaw] = useState('');
  const incomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(INCOME_KEY);
    if (stored) {
      const val = parseInt(stored, 10);
      if (!isNaN(val) && val > 0) {
        setIncome(val);
        setIncomeRaw(val.toLocaleString('es-CL'));
      }
    }
  }, []);

  const paymentEntries = useEntries({ types: ['payment'] });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return paymentEntries;
    return paymentEntries.filter((e) => e.title.toLowerCase().includes(q));
  }, [paymentEntries, search]);

  const totalExpenses = useMemo(
    () => paymentEntries.reduce((sum, e) => sum + (e.amount ?? 0), 0),
    [paymentEntries],
  );

  const pendingAmount = useMemo(
    () => paymentEntries.filter((e) => !e.done).reduce((sum, e) => sum + (e.amount ?? 0), 0),
    [paymentEntries],
  );

  const paidAmount = useMemo(
    () => paymentEntries.filter((e) => e.done).reduce((sum, e) => sum + (e.amount ?? 0), 0),
    [paymentEntries],
  );

  const pendingCount = useMemo(
    () => paymentEntries.filter((e) => !e.done).length,
    [paymentEntries],
  );

  const available = income - totalExpenses;
  const spentPercent = income > 0 ? Math.min((totalExpenses / income) * 100, 100) : 0;
  const isOverspent = income > 0 && available < 0;

  const saveIncome = () => {
    const val = parseInt(incomeRaw.replace(/[^\d]/g, ''), 10) || 0;
    setIncome(val);
    setIncomeRaw(val > 0 ? val.toLocaleString('es-CL') : '');
    localStorage.setItem(INCOME_KEY, String(val));
  };

  const handleToggle = async (id: number | undefined, done: boolean) => {
    if (id === undefined) return;
    await toggleEntryDone(id, !done);
  };

  const handleDelete = async (id: number | undefined) => {
    if (id === undefined) return;
    await deleteEntry(id);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ padding: '36px 24px 0' }}>
        <h1 style={{
          fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)',
          letterSpacing: '-0.02em', margin: 0,
        }}>
          Pagos
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
          {pendingCount > 0
            ? `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}`
            : 'Al día'}
        </p>
      </div>

      {/* Control card */}
      <div style={{ margin: '16px 20px 0' }}>
        <div className="glass-card" style={{ padding: '16px 18px' }}>

          {/* Income row */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: '14px',
          }}>
            <span style={{
              fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Ingreso mensual
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>$</span>
              <input
                ref={incomeRef}
                type="text"
                inputMode="numeric"
                placeholder="—"
                value={incomeRaw}
                onChange={(e) => setIncomeRaw(e.target.value)}
                onBlur={saveIncome}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { saveIncome(); incomeRef.current?.blur(); }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--glass-border)',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  width: '96px',
                  textAlign: 'right',
                  padding: '2px 0',
                }}
              />
            </div>
          </div>

          {/* Available balance — only when income is set */}
          {income > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{
                fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 3px',
                textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
              }}>
                Disponible
              </p>
              <p style={{
                fontSize: '28px', fontWeight: 600, fontFamily: 'var(--font-mono)',
                color: isOverspent ? '#c47070' : 'var(--text-primary)',
                letterSpacing: '-0.02em', margin: 0,
              }}>
                {formatCLP(available)}
              </p>
            </div>
          )}

          {/* Three stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 2px' }}>Gastos</p>
              <p style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 500, color: '#c47070', margin: 0 }}>
                {formatCLP(totalExpenses)}
              </p>
            </div>
            <div style={{ width: '1px', height: '28px', background: 'var(--glass-border)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 2px' }}>Pendiente</p>
              <p style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 500, color: '#b8944e', margin: 0 }}>
                {formatCLP(pendingAmount)}
              </p>
            </div>
            <div style={{ width: '1px', height: '28px', background: 'var(--glass-border)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 2px' }}>Pagado</p>
              <p style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 500, color: '#7a9e7e', margin: 0 }}>
                {formatCLP(paidAmount)}
              </p>
            </div>
          </div>

          {/* Progress bar: expenses vs income */}
          {income > 0 && (
            <div style={{
              marginTop: '12px', height: '3px',
              background: 'rgba(255,248,240,0.06)', borderRadius: '2px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${spentPercent}%`,
                height: '100%',
                background: isOverspent
                  ? 'linear-gradient(90deg, #b8944e, #c47070)'
                  : 'linear-gradient(90deg, #7a9e7e, #c9a882)',
                borderRadius: '2px',
                transition: 'width 0.4s ease',
              }} />
            </div>
          )}

          {totalExpenses === 0 && income === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', margin: '10px 0 0' }}>
              Sin pagos registrados
            </p>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ position: 'relative' }}>
          <svg
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input-base"
            type="text"
            placeholder="Buscar pagos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '32px' }}
          />
        </div>
      </div>

      {/* History / empty states */}
      {paymentEntries.length === 0 ? (

        /* Onboarding hint */
        <div style={{ padding: '12px 20px 0' }}>
          <div className="glass-card" style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              ¿Cómo agregar pagos?
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Escribe en la pantalla principal:
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['pagar luz 35k viernes', 'internet 29.990 mañana', 'arriendo 350k el 15'] as const).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(ex).catch(() => {}); }}
                  style={{
                    fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                    background: 'rgba(255,248,240,0.04)', border: '1px solid var(--glass-border)',
                    padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.55'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

      ) : filtered.length === 0 ? (

        <div className="empty-state" style={{ padding: '40px 24px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Sin resultados para &ldquo;{search}&rdquo;
          </p>
        </div>

      ) : (

        /* Minimal history list */
        <div style={{ margin: '16px 20px 0' }}>
          <p style={{
            fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            margin: '0 0 6px', paddingLeft: '2px',
          }}>
            Historial
          </p>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--glass-border)' : 'none',
                  opacity: entry.done ? 0.38 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {/* Circle checkbox */}
                <button
                  type="button"
                  onClick={() => { void handleToggle(entry.id, entry.done); }}
                  style={{
                    width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                    border: `1.5px solid ${entry.done ? 'var(--accent-human)' : 'var(--glass-border)'}`,
                    background: entry.done ? 'var(--accent-human)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  aria-label={entry.done ? 'Marcar pendiente' : 'Marcar pagado'}
                >
                  {entry.done && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                      stroke="var(--bg-void)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Date */}
                <span style={{
                  fontSize: '11px', fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)', flexShrink: 0, width: '44px',
                }}>
                  {entry.date ? formatDateShort(entry.date) : '—'}
                </span>

                {/* Title */}
                <span style={{
                  flex: 1, fontSize: '13px',
                  color: entry.done ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: entry.done ? 'line-through' : 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {entry.title}
                </span>

                {/* Amount */}
                {typeof entry.amount === 'number' && (
                  <span style={{
                    fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 500,
                    color: entry.done ? 'var(--text-muted)' : '#c9a882',
                    flexShrink: 0,
                  }}>
                    {formatCLP(entry.amount)}
                  </span>
                )}

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => { void handleDelete(entry.id); }}
                  style={{
                    width: '22px', height: '22px', background: 'transparent',
                    border: 'none', cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0.2, transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.2'; }}
                  aria-label="Eliminar"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
