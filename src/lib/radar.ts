import { parseTokens } from '@/core/agents/parser-agent';
import { normalizeRadarResult } from '@/core/cognitive/normalize-radar-result';
import { mapStoreContextToType } from '@/core/constants/store-patterns';
import type { EntryType, ParsedEntry, ShoppingMetadata, StoreType } from '@/types';

// ─── Allowed values ───────────────────────────────────────────────────────────

// ─── Public interface ─────────────────────────────────────────────────────────

export interface RadarResult {
  type: string;
  surface: string;
  title: string;
  summary: string | null;
  date_text: string | null;
  time: string | null;
  amount: number | null;
  currency: 'CLP' | null;
  priority: 'low' | 'normal' | 'urgent' | null;
  status: 'pending' | 'paid' | 'completed' | null;
  store_context: string | null;
  storeType: StoreType | null;
  checklist_items: string[];
  tags: string[];
  confidence: number;
  reason: string;
}

export function validateRadarResult(data: unknown, rawText = ''): RadarResult | null {
  const normalized = normalizeRadarResult(data, rawText);
  return normalized.data;
}

// ─── Type mapping ─────────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, EntryType> = {
  note: 'note',
  task: 'task',
  shopping_list: 'shopping_list',
  payment: 'payment',
  health: 'health',
  pet: 'pet',
  appointment: 'appointment',
  calendar: 'appointment',
  home: 'task',
};

// mapStoreType is now provided by @/core/constants/store-patterns (mapStoreContextToType)

// ─── Entry builder ────────────────────────────────────────────────────────────

export function radarToEntry(radar: RadarResult, rawText: string): ParsedEntry {
  const type: EntryType = TYPE_MAP[radar.type] ?? 'note';
  const tokens = parseTokens(rawText);

  const tags: string[] = Array.from(new Set([type, ...radar.tags]));
  if (radar.priority === 'urgent') tags.push('urgente');

  // ShoppingMetadata: ONLY for shopping_list.
  // pet/health use ChecklistItem records directly — no listKind:'shopping' to prevent
  // those entries from leaking into /purchases (which filters on metadata.listKind).
  let metadata: ParsedEntry['metadata'];
  if (type === 'shopping_list' && radar.checklist_items.length > 0) {
    const shoppingMeta: ShoppingMetadata = {
      listKind: 'shopping',
      storeType: radar.storeType ?? mapStoreContextToType(radar.store_context),
      items: radar.checklist_items.map((label) => ({
        id: crypto.randomUUID(),
        label,
        category: 'general',
        checked: false,
      })),
      progress: {
        total: radar.checklist_items.length,
        checked: 0,
        totalEstimated: 0,
        totalChecked: 0,
      },
    };
    metadata = shoppingMeta;
  }

  // checklistItems policy:
  // - shopping_list: yes (seeds ChecklistItem records + ShoppingMetadata)
  // - pet/health: yes (seeds ChecklistItem records only, no ShoppingMetadata)
  // - note/payment/appointment/task: no, even if the model returned items
  const acceptsChecklist = type === 'shopping_list' || type === 'pet' || type === 'health';

  return {
    text: rawText,
    type,
    title: radar.title,
    date: tokens.date ?? undefined,
    time: tokens.time ?? radar.time ?? undefined,
    tags,
    amount: radar.amount ?? undefined,
    checklistItems:
      acceptsChecklist && radar.checklist_items.length > 0
        ? radar.checklist_items
        : undefined,
    metadata,
    confidence: radar.confidence,
    reasons: [radar.reason],
  };
}

// ─── Client helper ────────────────────────────────────────────────────────────

let lastRequestTime = 0;
const DEBOUNCE_MS = 3000;

export async function radarIntake(text: string): Promise<RadarResult | null> {
  // Offline guard: never call AI when offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  // Debounce: prevent rapid-fire requests
  const now = Date.now();
  if (now - lastRequestTime < DEBOUNCE_MS) {
    return null;
  }
  lastRequestTime = now;

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('/api/radar/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, locale: 'es-CL' }),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (!res.ok) return null;

    const data: unknown = await res.json();

    // ok:false means server-side fallback triggered — skip AI path, use local heuristic
    if (
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      (data as Record<string, unknown>).ok === false
    ) return null;

    const validated = validateRadarResult(data, text);
    if (!validated) return null;
    if (validated.confidence < 0.75) return null;

    return validated;
  } catch {
    return null;
  }
}
