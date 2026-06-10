/**
 * Background reclassification — silently reclassify entries when AI is confident
 * and the user has not manually corrected the type.
 *
 * This runs on the client after an entry is saved with low-confidence heuristic.
 * If AI returns a higher-confidence result with a different type, we offer
 * a "¿Querías decir...?" hint in the Reader, but we NEVER auto-mutate.
 *
 * Usage: call `backgroundReclassify(entryId, text)` after `addEntry`.
 */

import { reclassifyEntry } from '@/db/entries';
import { radarIntake } from '@/lib/radar';

interface ReclassificationHint {
  suggestedType: string;
  confidence: number;
  reason: string;
}

let pendingReclassifications = new Map<string, ReclassificationHint>();

export function getPendingReclassification(localId: string): ReclassificationHint | undefined {
  return pendingReclassifications.get(localId);
}

export function clearPendingReclassification(localId: string): void {
  pendingReclassifications.delete(localId);
}

export async function backgroundReclassify(
  entryId: number,
  localId: string,
  text: string,
  currentType: string,
  currentConfidence: number,
): Promise<void> {
  // Only reclassify if the original was low-confidence
  if (currentConfidence >= 0.82) return;

  // Skip if the user has manually corrected this entry
  try {
    const entry = await (await import('@/db')).db.entries.get(entryId);
    const meta = (entry?.metadata ?? {}) as Record<string, unknown>;
    if (meta.manualType === true) return;
  } catch {
    // Dexie not available (SSR) — skip silently
    return;
  }

  const radar = await radarIntake(text);
  if (!radar) return;

  // Only suggest if AI is significantly more confident and proposes a different type
  const confidenceDelta = radar.confidence - currentConfidence;
  if (confidenceDelta < 0.15) return;
  if (radar.type === currentType) return;
  if (radar.confidence < 0.85) return;

  pendingReclassifications.set(localId, {
    suggestedType: radar.type,
    confidence: radar.confidence,
    reason: radar.reason,
  });
}

/**
 * Apply a pending reclassification hint.
 */
export async function applyReclassificationHint(
  entryId: number,
  localId: string,
): Promise<void> {
  const hint = pendingReclassifications.get(localId);
  if (!hint) return;

  await reclassifyEntry(entryId, {
    type: hint.suggestedType as Parameters<typeof reclassifyEntry>[1]['type'],
  });

  pendingReclassifications.delete(localId);
}
