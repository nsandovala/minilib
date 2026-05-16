export type SyncStatus = 'idle' | 'pulling' | 'pushing' | 'success' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastError: string | null;
  lastPullEntries: number | null;
  lastPullItems: number | null;
}

let _state: SyncState = {
  status: 'idle',
  lastPullAt: null,
  lastPushAt: null,
  lastError: null,
  lastPullEntries: null,
  lastPullItems: null,
};

export function getSyncState(): Readonly<SyncState> {
  return _state;
}

export function setSyncState(patch: Partial<SyncState>): void {
  _state = { ..._state, ...patch };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('liev:sync-state'));
  }
}
