// Client-only sync orchestrator — pull first, then push.
import { pull } from './pull';
import { push } from './push';
import { setSyncState } from './state';

export { pull, push };

let _running = false;

export async function sync(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  if (_running) return;

  _running = true;
  setSyncState({ status: 'pulling', lastError: null });
  try {
    await pull();
    setSyncState({ status: 'pushing' });
    await push();
    const now = new Date().toISOString();
    setSyncState({ status: 'success', lastError: null });
    try {
      localStorage.setItem('liev:last-sync-ok', now);
      localStorage.removeItem('liev:last-sync-error');
    } catch { /* storage unavailable */ }
  } catch (err) {
    const msg = String(err).slice(0, 120);
    setSyncState({ status: 'error', lastError: msg });
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[sync]', err);
    }
    try {
      localStorage.setItem('liev:last-sync-error', `${new Date().toISOString()} — ${msg}`);
    } catch { /* storage unavailable */ }
  } finally {
    setSyncState({ status: 'idle' });
    _running = false;
  }
}
