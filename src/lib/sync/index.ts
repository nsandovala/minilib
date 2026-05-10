// Client-only sync orchestrator — pull first, then push.
import { pull } from './pull';
import { push } from './push';

export { pull, push };

let _running = false;

export async function sync(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  if (_running) return;

  _running = true;
  try {
    await pull();
    await push();
  } catch (err) {
    // Offline-first: sync errors are non-fatal
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[sync]', err);
    }
  } finally {
    _running = false;
  }
}
