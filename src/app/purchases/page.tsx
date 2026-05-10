'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useEntries } from '@/hooks/useEntries';
import TimelineView from '@/components/TimelineView';
import type { TimelineEntry, ChecklistItem } from '@/types';

function getShoppingLists(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((e) => e.type === 'shopping_list');
}

function getOtherPurchases(entries: TimelineEntry[]): TimelineEntry[] {
  const terms = ['comprar', 'super', 'mercado', 'feria', 'despensa', 'verdura', 'fruta', 'abarrote', 'limpieza'];
  return entries.filter((e) => {
    if (e.type === 'shopping_list' || e.type === 'payment') return false;
    const h = `${e.title} ${e.text}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return terms.some((t) => h.includes(t));
  });
}

interface ShoppingSummaryProps {
  lists: TimelineEntry[];
  itemsByEntry: Map<string, ChecklistItem[]>;
}

function ShoppingSummary({ lists, itemsByEntry }: ShoppingSummaryProps) {
  const activeLists = lists.filter((e) => !e.done);
  if (activeLists.length === 0) return null;

  let totalItems   = 0;
  let checkedItems = 0;

  for (const list of activeLists) {
    const items = (itemsByEntry.get(list.localId) ?? []).filter((i) => !i.deletedAt);
    totalItems   += items.length;
    checkedItems += items.filter((i) => i.checked).length;
  }

  const pct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  return (
    <div
      className="glass-card"
      style={{
        margin: '0 20px 14px',
        padding: '14px 16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '12px',
      }}
    >
      <SummaryCell label="Listas" value={String(activeLists.length)} />
      <SummaryCell
        label="Ítems"
        value={`${checkedItems}`}
        suffix={`/${totalItems}`}
      />
      <SummaryCell
        label="Completado"
        value={`${pct}%`}
        highlight={pct === 100}
      />

      {totalItems > 0 && (
        <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
          <div
            style={{
              height: '3px',
              borderRadius: '999px',
              background: 'rgba(255,248,240,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: '999px',
                background: pct === 100 ? '#7a9e7e' : 'var(--accent-human)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 600, color: highlight ? '#7a9e7e' : 'var(--text-primary)' }}>
        {value}
        {suffix && (
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' }}>
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

export default function PurchasesPage() {
  const entries    = useEntries();
  const allItems   = useLiveQuery(() => db.checklist_items.toArray(), [], []) ?? [];

  const itemsByEntry = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of allItems) {
      const list = map.get(item.localEntryId) ?? [];
      list.push(item);
      map.set(item.localEntryId, list);
    }
    return map;
  }, [allItems]);

  const shoppingLists  = useMemo(() => getShoppingLists(entries), [entries]);
  const otherPurchases = useMemo(() => getOtherPurchases(entries), [entries]);
  const allPurchases   = useMemo(
    () => [...shoppingLists, ...otherPurchases],
    [shoppingLists, otherPurchases],
  );

  const activeListCount = shoppingLists.filter((e) => !e.done).length;

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Compras</h1>
          <p className="page-subtitle">
            {activeListCount > 0
              ? `${activeListCount} lista${activeListCount !== 1 ? 's' : ''} activa${activeListCount !== 1 ? 's' : ''}`
              : 'Despensa, mercado, cosas para la casa.'}
          </p>
        </div>
      </div>

      <div style={{ padding: '0 20px 14px' }}>
        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          Anota una lista y marca ítems al ir al súper.
        </p>
      </div>

      <ShoppingSummary lists={shoppingLists} itemsByEntry={itemsByEntry} />

      {allPurchases.length === 0 ? (
        <div className="empty-state" style={{ margin: '0 20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Sin compras registradas</p>
          <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Prueba: &quot;leche, huevos, pan, mantequilla&quot;
          </p>
        </div>
      ) : (
        <TimelineView entries={allPurchases} onRefresh={() => void 0} />
      )}
    </div>
  );
}
