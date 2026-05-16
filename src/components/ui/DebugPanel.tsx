'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { recordBelongsToUser } from '@/lib/local-user';
import { getSyncState, type SyncState } from '@/lib/sync/state';
import { pull, push } from '@/lib/sync';

interface DebugState {
  localCount: number | null;
  checklistLocalCount: number | null;
  unsyncedCount: number | null;
  idbAvailable: boolean;
  onLine: boolean;
  ua: string;
  lastSyncOk: string | null;
  lastSyncError: string | null;
  lastSaveError: string | null;
  byType: Record<string, number>;
  shoppingListNoItems: number;
  shoppingListWithAmount: number;
}

const EMPTY_STATE: DebugState = {
  localCount: null,
  checklistLocalCount: null,
  unsyncedCount: null,
  idbAvailable: false,
  onLine: true,
  ua: '',
  lastSyncOk: null,
  lastSyncError: null,
  lastSaveError: null,
  byType: {},
  shoppingListNoItems: 0,
  shoppingListWithAmount: 0,
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString(); } catch { return iso.slice(11, 19); }
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const color = ok === true ? '#7a9e7e' : ok === false ? '#c47070' : 'rgba(255,255,255,0.8)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', minHeight: '15px' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{label}</span>
      <span style={{ color, textAlign: 'right', wordBreak: 'break-all', maxWidth: '170px' }}>{value}</span>
    </div>
  );
}

function Sep({ label }: { label: string }) {
  return (
    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', marginTop: '6px', marginBottom: '2px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '5px', letterSpacing: '0.05em' }}>
      {label}
    </div>
  );
}

function Btn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, fontSize: '9px', padding: '3px 2px', borderRadius: '5px',
        background: danger ? 'rgba(180,60,60,0.2)' : 'rgba(255,255,255,0.07)',
        border: `1px solid ${danger ? 'rgba(180,60,60,0.4)' : 'rgba(255,255,255,0.13)'}`,
        color: danger ? '#e08080' : '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

async function checkIDB(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('__liev_probe__', 1);
      req.onsuccess = () => { req.result.close(); resolve(true); };
      req.onerror  = () => resolve(false);
    } catch { resolve(false); }
  });
}

export default function DebugPanel() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const [visible, setVisible]     = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy]           = useState(false);
  const [state, setState]         = useState<DebugState>(EMPTY_STATE);
  const [syncSt, setSyncSt]       = useState<SyncState>(getSyncState());

  // Visible cuando NEXT_PUBLIC_SHOW_DEBUG=true (funciona también en producción)
  useEffect(() => {
    setVisible(process.env.NEXT_PUBLIC_SHOW_DEBUG === 'true');
  }, []);

  // Suscripción al estado de sync en tiempo real vía custom event
  useEffect(() => {
    const handler = () => setSyncSt({ ...getSyncState() });
    window.addEventListener('liev:sync-state', handler);
    return () => window.removeEventListener('liev:sync-state', handler);
  }, []);

  const runChecks = useCallback(async () => {
    const idb    = await checkIDB();
    const online = navigator.onLine;
    let localCount: number | null           = null;
    let checklistLocalCount: number | null  = null;
    let unsyncedCount: number | null        = null;
    const byType: Record<string, number>   = {};
    let shoppingListNoItems                 = 0;
    let shoppingListWithAmount              = 0;

    if (idb) {
      try {
        const { db } = await import('@/db');
        const uid     = userId ?? null;
        const entries = await db.entries.toArray();
        const items   = await db.checklist_items.toArray();

        const myEntries = entries.filter((e) => recordBelongsToUser(e.ownerUserId, uid));
        const myItems   = items.filter((i) => recordBelongsToUser(i.ownerUserId, uid));

        localCount          = myEntries.length;
        checklistLocalCount = myItems.length;
        unsyncedCount       = myEntries.filter((e) => !e.syncedAt).length;

        for (const e of myEntries) {
          byType[e.type] = (byType[e.type] ?? 0) + 1;
        }

        // Count checklist items per entry
        const itemsPerEntry = new Map<string, number>();
        for (const item of myItems) {
          itemsPerEntry.set(item.localEntryId, (itemsPerEntry.get(item.localEntryId) ?? 0) + 1);
        }

        // Heuristic: shopping_list entries that look misclassified
        const sl = myEntries.filter((e) => e.type === 'shopping_list');
        for (const e of sl) {
          const typed = e as unknown as { listItems?: unknown[]; checklistItems?: unknown[] };
          const hasItems =
            (itemsPerEntry.get(e.localId) ?? 0) > 0 ||
            (typed.listItems?.length ?? 0) > 0 ||
            (typed.checklistItems?.length ?? 0) > 0;
          if (!hasItems) shoppingListNoItems++;
          if (e.amount !== null && e.amount !== undefined) shoppingListWithAmount++;
        }
      } catch { /* silent */ }
    }

    const lastSyncOk    = localStorage.getItem('liev:last-sync-ok');
    const lastSyncError = localStorage.getItem('liev:last-sync-error');
    const lastSaveError = localStorage.getItem('liev:last-save-error');

    setState({
      idbAvailable: idb, onLine: online,
      localCount, checklistLocalCount, unsyncedCount,
      lastSyncOk, lastSyncError, lastSaveError,
      byType, shoppingListNoItems, shoppingListWithAmount,
      ua: navigator.userAgent.slice(0, 70),
    });
  }, [userId]);

  useEffect(() => {
    if (!visible || !isLoaded) return;
    runChecks();
  }, [visible, isLoaded, runChecks]);

  const handleForcePull = useCallback(async () => {
    if (!isSignedIn || busy) return;
    setBusy(true);
    try { await pull(); } finally { setBusy(false); runChecks(); }
  }, [isSignedIn, busy, runChecks]);

  const handleForcePush = useCallback(async () => {
    if (!isSignedIn || busy) return;
    setBusy(true);
    try { await push(); } finally { setBusy(false); runChecks(); }
  }, [isSignedIn, busy, runChecks]);

  const handleRehydrate = useCallback(async () => {
    if (!isSignedIn || !userId || !state.idbAvailable || busy) return;
    if (!confirm('Borrar entradas locales de este usuario y rehidratar desde cloud?')) return;
    setBusy(true);
    try {
      const { db } = await import('@/db');
      const uid     = userId;
      const entries = await db.entries.toArray();
      const items   = await db.checklist_items.toArray();
      const eIds    = entries.filter((e) => recordBelongsToUser(e.ownerUserId, uid)).map((e) => e.id).filter((id): id is number => typeof id === 'number');
      const iIds    = items.filter((i) => recordBelongsToUser(i.ownerUserId, uid)).map((i) => i.id).filter((id): id is number => typeof id === 'number');
      await db.entries.bulkDelete(eIds);
      await db.checklist_items.bulkDelete(iIds);
      await pull();
    } finally {
      setBusy(false);
      runChecks();
    }
  }, [isSignedIn, userId, state.idbAvailable, busy, runChecks]);

  if (!visible) return null;

  const statusColor = (s: SyncState['status']) =>
    s === 'success' ? '#7a9e7e' : s === 'error' ? '#c47070' : s === 'idle' ? 'rgba(255,255,255,0.4)' : '#c9a882';

  return (
    <div style={{
      position: 'fixed', bottom: '80px', right: '10px', zIndex: 9999,
      background: 'rgba(5,5,8,0.97)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '12px', padding: '10px 12px', fontSize: '10px',
      fontFamily: 'monospace', color: '#f0f0f0', width: '250px',
      lineHeight: '1.6', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    }}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}
      >
        <span style={{ fontWeight: 700, color: '#c9a882', fontSize: '11px' }}>
          Liev Debug{busy ? ' ⟳' : ''}
        </span>
        <span style={{ color: statusColor(syncSt.status), fontSize: '9px', alignSelf: 'center' }}>
          {syncSt.status} {collapsed ? '▲' : '▼'}
        </span>
      </button>

      {!collapsed && (
        <>
          <Sep label="AUTH" />
          <Row label="loaded"    value={String(isLoaded)} />
          <Row label="signedIn"  value={String(isSignedIn)} ok={isSignedIn === true} />
          <Row label="userId"    value={userId ?? '—'}      ok={!!userId} />

          <Sep label="LOCAL DB" />
          <Row label="IDB"      value={state.idbAvailable ? 'ok' : 'unavail'} ok={state.idbAvailable} />
          <Row label="online"   value={String(state.onLine)} ok={state.onLine} />
          <Row label="entries"  value={state.localCount !== null ? String(state.localCount) : '…'} />
          <Row label="items"    value={state.checklistLocalCount !== null ? String(state.checklistLocalCount) : '…'} />
          <Row label="unsynced" value={state.unsyncedCount !== null ? String(state.unsyncedCount) : '…'}
               ok={state.unsyncedCount === 0 ? true : state.unsyncedCount !== null ? false : undefined} />

          <Sep label="SYNC" />
          <Row label="status"  value={syncSt.status} ok={syncSt.status === 'success' ? true : syncSt.status === 'error' ? false : undefined} />
          <Row label="pull at" value={fmt(syncSt.lastPullAt)} />
          <Row label="pull ↓"  value={syncSt.lastPullEntries !== null ? `${syncSt.lastPullEntries}e / ${syncSt.lastPullItems ?? 0}i` : '—'} />
          <Row label="push at" value={fmt(syncSt.lastPushAt)} />
          <Row label="last ok" value={fmt(state.lastSyncOk)} ok={!!state.lastSyncOk} />
          {syncSt.lastError && (
            <Row label="error" value={syncSt.lastError.slice(0, 55)} ok={false} />
          )}
          {state.lastSyncError && !syncSt.lastError && (
            <Row label="prev err" value={state.lastSyncError.slice(0, 55)} ok={false} />
          )}

          {Object.keys(state.byType).length > 0 && (
            <>
              <Sep label="TIPOS" />
              {Object.entries(state.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <Row
                  key={type} label={type} value={String(count)}
                  ok={type === 'shopping_list' && (state.shoppingListNoItems > 0 || state.shoppingListWithAmount > 0) ? false : undefined}
                />
              ))}
              {(state.byType['shopping_list'] ?? 0) > 0 && (
                <>
                  <Row label="  sin items"  value={String(state.shoppingListNoItems)}   ok={state.shoppingListNoItems === 0} />
                  <Row label="  con amount" value={String(state.shoppingListWithAmount)} ok={state.shoppingListWithAmount === 0} />
                </>
              )}
            </>
          )}

          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.18)', marginTop: '6px', wordBreak: 'break-word' }}>
            {state.ua}
          </div>

          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
            <Btn label="↓ pull"     onClick={handleForcePull} />
            <Btn label="↑ push"     onClick={handleForcePush} />
            <Btn label="rehidratar" onClick={handleRehydrate} danger />
          </div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <Btn label="re-check" onClick={runChecks} />
            <Btn label="clear logs" onClick={() => {
              localStorage.removeItem('liev:last-save-error');
              localStorage.removeItem('liev:last-sync-error');
              setState((s) => ({ ...s, lastSaveError: null, lastSyncError: null }));
            }} />
          </div>
        </>
      )}
    </div>
  );
}
