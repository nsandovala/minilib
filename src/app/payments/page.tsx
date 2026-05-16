'use client';

import { useMemo, useState } from 'react';
import { useEntries } from '@/hooks/useEntries';
import { createEntry, deleteEntry, toggleEntryDone } from '@/db/entries';
import type { TimelineEntry } from '@/types';
import {
  formatCLP,
  formatRelativeDate,
  getEntryDisplayTitle,
  getFinancialDirection,
  getFinancialCategory,
  getEntrySemanticInterpretation,
  getEntryNextStep,
  isOverdue,
} from '@/lib/entries';
import { PAYMENT_AGENT } from '@/core/card-agents';

type Tab = 'all' | 'income' | 'expense';
type ManualMode = 'income' | 'payment' | 'purchase';

function formatDateShort(dateStr: string): string {
  const rel = formatRelativeDate(dateStr);
  if (rel === 'hoy' || rel === 'mañana') return rel;
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' });
}

function getStatusLabel(entry: TimelineEntry): { text: string; color: string } {
  const direction = getFinancialDirection(entry);
  if (isOverdue(entry)) return { text: 'vencido', color: '#c47070' };
  if (entry.done && direction === 'income') return { text: 'recibido', color: '#7a9e7e' };
  if (entry.done && direction === 'expense') return { text: 'pagado', color: '#7a9e7e' };
  return { text: 'pendiente', color: '#b8944e' };
}

function buildManualEntry(mode: ManualMode, concept: string, amount: number) {
  const cleanConcept = concept.trim();

  if (mode === 'income') {
    return {
      type: 'payment' as const,
      text: cleanConcept ? `Ingreso ${cleanConcept} ${amount}` : `Ingreso ${amount}`,
      title: cleanConcept ? `Ingreso ${cleanConcept}` : 'Ingreso manual',
      tags: ['payment', 'manual', 'income'],
      amount,
      done: false,
    };
  }

  if (mode === 'purchase') {
    return {
      type: 'payment' as const,
      text: cleanConcept ? `Compra ${cleanConcept} ${amount}` : `Compra ${amount}`,
      title: cleanConcept ? `Compra ${cleanConcept}` : 'Compra manual',
      tags: ['payment', 'manual', 'purchase'],
      amount,
      done: false,
    };
  }

  return {
    type: 'payment' as const,
    text: cleanConcept ? `Pagar ${cleanConcept} ${amount}` : `Pago ${amount}`,
    title: cleanConcept ? `Pagar ${cleanConcept}` : 'Pago manual',
    tags: ['payment', 'manual', 'expense'],
    amount,
    done: false,
  };
}

interface SummaryRowProps {
  label: string;
  value: number;
  color: string;
  dim?: boolean;
}

function SummaryRow({ label, value, color, dim }: SummaryRowProps) {
  return (
    <div style={{ minWidth: 0 }}>
      <p
        style={{
          margin: 0,
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: '3px 0 0',
          fontFamily: 'var(--font-mono)',
          fontSize: '18px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: dim ? 'var(--text-muted)' : color,
        }}
      >
        {value === 0 ? '—' : formatCLP(value)}
      </p>
    </div>
  );
}

function MiniBars({ totalIncome, totalExpenses, available }: { totalIncome: number; totalExpenses: number; available: number }) {
  const maxValue = Math.max(totalIncome, totalExpenses, Math.abs(available), 1);
  const bars = [
    { label: 'Ingresa', value: totalIncome, color: '#7a9e7e' },
    { label: 'Sale', value: totalExpenses, color: '#c9a882' },
    { label: 'Queda', value: Math.max(available, 0), color: available < 0 ? '#c47070' : 'rgba(245,240,235,0.72)' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '10px',
        alignItems: 'end',
        marginTop: '14px',
      }}
    >
      {bars.map((bar) => (
        <div key={bar.label} style={{ minWidth: 0 }}>
          <div
            style={{
              height: '46px',
              display: 'flex',
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${Math.max(12, Math.round((bar.value / maxValue) * 46))}px`,
                borderRadius: '10px',
                background: `linear-gradient(180deg, ${bar.color}, ${bar.color}bb)`,
                opacity: bar.value === 0 ? 0.2 : 1,
                transition: 'height 0.25s ease',
              }}
            />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>{bar.label}</p>
        </div>
      ))}
    </div>
  );
}

interface ManualComposerProps {
  onSubmit: (mode: ManualMode, concept: string, amount: number) => Promise<void>;
}

function ManualComposer({ onSubmit }: ManualComposerProps) {
  const [mode, setMode] = useState<ManualMode>('income');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseInt(amount.replace(/[^\d]/g, ''), 10) || 0;
    if (!numericAmount || saving) return;

    setSaving(true);
    try {
      await onSubmit(mode, concept, numericAmount);
      setConcept('');
      setAmount('');
      setMode('income');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '14px' }}>
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {([
          { id: 'income' as ManualMode, label: 'Ingreso' },
          { id: 'payment' as ManualMode, label: 'Pago' },
          { id: 'purchase' as ManualMode, label: 'Compra' },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip${mode === item.id ? ' active' : ''}`}
            onClick={() => setMode(item.id)}
            style={{ flexShrink: 0 }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr auto', gap: '8px', marginTop: '10px' }}>
        <input
          className="input-base"
          type="text"
          placeholder={mode === 'income' ? 'Ej. sueldo, venta, depósito' : mode === 'purchase' ? 'Ej. feria, súper, casa' : 'Ej. luz, internet, arriendo'}
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          style={{ minWidth: 0 }}
        />
        <input
          className="input-base"
          type="text"
          inputMode="numeric"
          placeholder="$0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ minWidth: 0 }}
        />
        <button
          type="submit"
          className="chip active"
          disabled={saving || !amount.trim()}
          style={{
            opacity: saving || !amount.trim() ? 0.45 : 1,
            cursor: saving || !amount.trim() ? 'default' : 'pointer',
            alignSelf: 'stretch',
          }}
        >
          {saving ? '...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

interface EntryCardProps {
  entry: TimelineEntry;
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
}

function EntryCard({ entry, onToggle, onDelete }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const direction = getFinancialDirection(entry);
  const category = getFinancialCategory(entry);
  const status = getStatusLabel(entry);
  const displayTitle = getEntryDisplayTitle(entry);
  const isIncome = direction === 'income';
  const directionColor = isIncome ? '#7a9e7e' : '#c9a882';
  const directionLabel = isIncome ? 'ingreso' : 'egreso';

  return (
    <div
      style={{
        padding: '12px 14px',
        opacity: entry.done ? 0.52 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <button
          type="button"
          onClick={() => { if (entry.id !== undefined) onToggle(entry.id, entry.done); }}
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            flexShrink: 0,
            marginTop: '2px',
            border: `1.5px solid ${entry.done ? directionColor : 'var(--glass-border)'}`,
            background: entry.done ? directionColor : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          aria-label={entry.done ? 'Marcar pendiente' : 'Marcar completado'}
        >
          {entry.done && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--bg-void)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
          aria-expanded={expanded}
        >
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: entry.done ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: entry.done ? 'line-through' : 'none',
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            {displayTitle}
          </p>
        </button>

        {typeof entry.amount === 'number' && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 600,
              color: entry.done ? 'var(--text-muted)' : isIncome ? '#7a9e7e' : '#c9a882',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              marginTop: '1px',
            }}
          >
            {isIncome ? '+' : ''}{formatCLP(entry.amount)}
          </span>
        )}

        <button
          type="button"
          onClick={() => { if (entry.id !== undefined) onDelete(entry.id); }}
          style={{
            width: '20px',
            height: '20px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.2,
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.2'; }}
          aria-label="Eliminar"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px', paddingLeft: '28px' }}>
        <span
          style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: '8px',
            border: `1px solid ${directionColor}33`,
            background: `${directionColor}14`,
            color: directionColor,
            lineHeight: 1.7,
            fontWeight: 500,
          }}
        >
          {directionLabel}
        </span>

        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {category}
        </span>

        {entry.date && (
          <>
            <span style={{ width: '2px', height: '2px', borderRadius: '50%', background: 'var(--glass-border)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: isOverdue(entry) ? '#c47070' : 'var(--text-muted)',
              }}
            >
              {formatDateShort(entry.date)}
            </span>
          </>
        )}

        <span
          style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: '8px',
            border: `1px solid ${status.color}22`,
            background: `${status.color}10`,
            color: status.color,
            lineHeight: 1.7,
          }}
        >
          {status.text}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.22s ease',
          paddingLeft: '28px',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              borderTop: '1px solid rgba(255,248,240,0.06)',
              marginTop: '10px',
              paddingTop: '10px',
              display: 'grid',
              gap: '5px',
            }}
          >
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {entry.text}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {getEntrySemanticInterpretation(entry)}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {getEntryNextStep(entry)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('all');

  const allEntries = useEntries();

  const financeEntries = useMemo(
    () => allEntries.filter((entry) => typeof entry.amount === 'number' && !Number.isNaN(entry.amount)),
    [allEntries],
  );

  const incomeEntries = useMemo(
    () => financeEntries.filter((entry) => entry.type === 'payment' && getFinancialDirection(entry) === 'income'),
    [financeEntries],
  );

  const expenseEntries = useMemo(
    () => financeEntries.filter((entry) => !(entry.type === 'payment' && getFinancialDirection(entry) === 'income')),
    [financeEntries],
  );

  const totalIncome = useMemo(() => incomeEntries.reduce((s, e) => s + (e.amount ?? 0), 0), [incomeEntries]);
  const totalExpenses = useMemo(() => expenseEntries.reduce((s, e) => s + (e.amount ?? 0), 0), [expenseEntries]);
  const available = totalIncome - totalExpenses;

  const pendingExpenses = useMemo(
    () => expenseEntries.filter((e) => !e.done).reduce((s, e) => s + (e.amount ?? 0), 0),
    [expenseEntries],
  );
  const paidExpenses = useMemo(
    () => expenseEntries.filter((e) => e.done).reduce((s, e) => s + (e.amount ?? 0), 0),
    [expenseEntries],
  );

  const spentPct = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0;
  const isOverspent = totalIncome > 0 && available < 0;

  const baseEntries = useMemo(() => {
    if (activeTab === 'income') return incomeEntries;
    if (activeTab === 'expense') return expenseEntries;
    return financeEntries;
  }, [activeTab, financeEntries, incomeEntries, expenseEntries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseEntries;
    return baseEntries.filter((entry) => {
      const title = getEntryDisplayTitle(entry).toLowerCase();
      return title.includes(q) || entry.text.toLowerCase().includes(q);
    });
  }, [baseEntries, search]);

  const handleToggle = async (id: number, done: boolean) => {
    await toggleEntryDone(id, !done);
  };

  const handleDelete = async (id: number) => {
    await deleteEntry(id);
  };

  const handleCreateManual = async (mode: ManualMode, concept: string, amount: number) => {
    await createEntry(buildManualEntry(mode, concept, amount));
  };

  const hasEntries = financeEntries.length > 0;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '48px' }}>
      <div style={{ padding: '36px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Finanzas
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '5px 0 0', lineHeight: 1.5 }}>
              Lo que entra se descuenta de pagos, compras y gastos con monto.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            aria-label="Buscar movimientos"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '999px',
              border: '1px solid rgba(255,248,240,0.08)',
              background: 'rgba(255,248,240,0.04)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>

        {searchOpen && (
          <div style={{ marginTop: '12px' }}>
            <input
              className="input-base"
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: '13px' }}
            />
          </div>
        )}
      </div>

      <div style={{ margin: '16px 20px 0' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0', marginBottom: '12px' }}>
            <SummaryRow label="Ingresos" value={totalIncome} color="#7a9e7e" dim={totalIncome === 0} />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <SummaryRow label="Egresos" value={totalExpenses} color="#c47070" dim={totalExpenses === 0} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SummaryRow
                label="Disponible"
                value={Math.abs(available)}
                color={isOverspent ? '#c47070' : available > 0 ? 'var(--text-primary)' : 'var(--text-muted)'}
                dim={totalIncome === 0 && totalExpenses === 0}
              />
            </div>
          </div>

          {totalIncome > 0 && (
            <div
              style={{
                height: '3px',
                background: 'rgba(255,248,240,0.06)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${spentPct}%`,
                  height: '100%',
                  background: isOverspent
                    ? 'linear-gradient(90deg, #b8944e, #c47070)'
                    : 'linear-gradient(90deg, #7a9e7e, #c9a882)',
                  borderRadius: '2px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          )}

          <MiniBars totalIncome={totalIncome} totalExpenses={totalExpenses} available={available} />

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '14px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Pendiente
              </p>
              <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: '13px', color: pendingExpenses > 0 ? '#b8944e' : 'var(--text-muted)' }}>
                {pendingExpenses > 0 ? formatCLP(pendingExpenses) : '—'}
              </p>
            </div>
            <div style={{ width: '1px', height: '32px', background: 'var(--glass-border)', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Resuelto
              </p>
              <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: '13px', color: paidExpenses > 0 ? '#7a9e7e' : 'var(--text-muted)' }}>
                {paidExpenses > 0 ? formatCLP(paidExpenses) : '—'}
              </p>
            </div>
            {isOverspent && (
              <>
                <div style={{ width: '1px', height: '32px', background: 'var(--glass-border)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '11px', color: '#d6a2a2', lineHeight: 1.4, flex: 1 }}>
                  Tus egresos superan tus ingresos por {formatCLP(Math.abs(available))}.
                </p>
              </>
            )}
          </div>

          <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,248,240,0.06)', paddingTop: '14px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Agrega ingresos, pagos o compras manuales. Se guardan como movimientos y entran al balance de inmediato.
            </p>
            <ManualComposer onSubmit={handleCreateManual} />
          </div>

          {!hasEntries && (
            <p style={{ margin: '14px 0 0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Sin movimientos registrados
            </p>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {([
            { id: 'all' as Tab, label: 'Todos' },
            { id: 'income' as Tab, label: `Ingresos${incomeEntries.length ? ` · ${incomeEntries.length}` : ''}` },
            { id: 'expense' as Tab, label: `Egresos${expenseEntries.length ? ` · ${expenseEntries.length}` : ''}` },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`chip${activeTab === id ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
              style={{ flexShrink: 0 }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasEntries ? (
        <div style={{ padding: '12px 20px 0' }}>
          <div className="glass-card" style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
              ¿Cómo registrar movimientos?
            </p>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Puedes escribir en la pantalla principal o guardarlos aquí manualmente.
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                'sueldo 1.200.000',
                'me pagaron 150k venta',
                'pagar luz 35k viernes',
                'compra feria 18k',
              ].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(ex).catch(() => {}); }}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    background: 'rgba(255,248,240,0.04)',
                    border: '1px solid var(--glass-border)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 24px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {search ? `Sin resultados para "${search}"` : PAYMENT_AGENT.ui.emptyState.title}
          </p>
          {!search && (
            <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {PAYMENT_AGENT.ui.emptyState.body}
            </p>
          )}
        </div>
      ) : (
        <div style={{ margin: '12px 20px 0' }}>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.map((entry, i) => (
              <div
                key={entry.localId}
                style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,248,240,0.05)' : 'none',
                }}
              >
                <EntryCard
                  entry={entry}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
