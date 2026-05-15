'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { recordBelongsToUser } from '@/lib/local-user';

interface DebugState {
  localCount: number | null;
  unsyncedCount: number | null;
  pullStatus: string | null;
  lastSyncOk: string | null;
  lastSyncError: string | null;
  lastSaveError: string | null;
  idbAvailable: boolean;
  onLine: boolean;
  ua: string;
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const color = ok === true ? '#7a9e7e' : ok === false ? '#c47070' : 'rgba(255,255,255,0.8)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', minHeight: '16px' }}>
      <span style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{label}</span>
      <span style={{ color, textAlign: 'right', wordBreak: 'break-all', maxWidth: '160px' }}>{value}</span>
    </div>
  );
}

async function checkIDB(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('__liev_probe__', 1);
      req.onsuccess = () => { req.result.close(); resolve(true); };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export default function DebugPanel() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [state, setState] = useState<DebugState>({
    localCount: null,
    unsyncedCount: null,
    pullStatus: null,
    lastSyncOk: null,
    lastSyncError: null,
    lastSaveError: null,
    idbAvailable: false,
    onLine: true,
    ua: '',
  });

  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    const showDebug = process.env.NEXT_PUBLIC_SHOW_DEBUG === 'true';
    setVisible(isDev && showDebug);
  }, []);

  const runChecks = useCallback(async () => {
    const idb = await checkIDB();
    const online = navigator.onLine;

    let localCount: number | null = null;
    let unsyncedCount: number | null = null;
    if (idb) {
      try {
        const { db } = await import('@/db');
        const entries = await db.entries.toArray();
        localCount = entries.filter((entry) => recordBelongsToUser(entry.ownerUserId, userId ?? null)).length;
        unsyncedCount = entries.filter((entry) => !entry.syncedAt && recordBelongsToUser(entry.ownerUserId, userId ?? null)).length;
      } catch { /* silent */ }
    }

    let pullStatus: string | null = null;
    try {
      const res = await fetch('/api/sync/pull', { signal: AbortSignal.timeout(5000) });
      pullStatus = `${res.status} ${res.statusText}`;
    } catch (e) {
      pullStatus = `error: ${String(e).slice(0, 40)}`;
    }

    const lastSyncOk = localStorage.getItem('liev:last-sync-ok');
    const lastSyncError = localStorage.getItem('liev:last-sync-error');
    const lastSaveError = localStorage.getItem('liev:last-save-error');
    const ua = navigator.userAgent.slice(0, 60);

    setState({ idbAvailable: idb, onLine: online, localCount, unsyncedCount, pullStatus, lastSyncOk, lastSyncError, lastSaveError, ua });
  }, []);

  useEffect(() => {
    if (!visible || !isLoaded) return;
    runChecks();
  }, [visible, isLoaded, runChecks]);

  if (!visible) return null;

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '80px',
    right: '10px',
    zIndex: 9999,
    background: 'rgba(5,5,8,0.96)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '10px 12px',
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#f0f0f0',
    width: '240px',
    lineHeight: '1.65',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };

  return (
    <div style={panelStyle}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}
      >
        <span style={{ fontWeight: 700, color: '#c9a882', fontSize: '11px' }}>🔍 Liev Debug</span>
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>{collapsed ? '▲' : '▼'}</span>
      </button>

      {!collapsed && (
        <>
          <div style={{ display: 'grid', gap: '2px', marginBottom: '8px' }}>
            <Row label="auth loaded"    value={String(isLoaded)} />
            <Row label="signed in"      value={String(isSignedIn)}             ok={isSignedIn === true} />
            <Row label="userId"         value={userId ? `${userId.slice(0, 10)}…` : '—'} ok={!!userId} />
            <Row label="IDB"            value={state.idbAvailable ? 'ok' : 'unavailable'} ok={state.idbAvailable} />
            <Row label="online"         value={String(state.onLine)} ok={state.onLine} />
            <Row label="local entries"  value={state.localCount !== null ? String(state.localCount) : '…'} />
            <Row label="unsynced"       value={state.unsyncedCount !== null ? String(state.unsyncedCount) : '…'} />
            <Row
              label="pull"
              value={state.pullStatus ?? '…'}
              ok={state.pullStatus?.startsWith('200') ? true : state.pullStatus ? false : undefined}
            />
            {state.lastSyncOk && (
              <Row label="last sync ok"   value={state.lastSyncOk.slice(11, 19)} />
            )}
            {state.lastSyncError && (
              <Row label="sync error"     value={state.lastSyncError.slice(0, 50)} ok={false} />
            )}
            {state.lastSaveError && (
              <Row label="save error"     value={state.lastSaveError.slice(0, 50)} ok={false} />
            )}
          </div>

          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginBottom: '6px', wordBreak: 'break-word' }}>
            {state.ua}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={runChecks}
              style={{ flex: 1, fontSize: '10px', padding: '3px 0', borderRadius: '5px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer' }}
            >
              re-check
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('liev:last-save-error');
                localStorage.removeItem('liev:last-sync-error');
                setState((s) => ({ ...s, lastSaveError: null, lastSyncError: null }));
              }}
              style={{ flex: 1, fontSize: '10px', padding: '3px 0', borderRadius: '5px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
            >
              clear logs
            </button>
          </div>
        </>
      )}
    </div>
  );
}
