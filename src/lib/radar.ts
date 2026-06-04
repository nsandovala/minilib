import { parseTokens } from '@/core/agents/parser-agent';
import type { EntryType, ParsedEntry, ShoppingMetadata, StoreType } from '@/types';

// ─── Allowed values ───────────────────────────────────────────────────────────

const VALID_RADAR_TYPES = new Set([
  'note', 'task', 'shopping_list', 'payment', 'health', 'pet', 'calendar', 'home',
]);
const VALID_SURFACES = new Set([
  'notes', 'todos', 'purchases', 'payments', 'health', 'pets', 'calendar', 'appointments', 'home',
]);
const VALID_PRIORITIES = new Set(['low', 'normal', 'urgent']);
const VALID_STATUSES = new Set(['pending', 'paid', 'completed']);

// ─── Sanitizer sets ───────────────────────────────────────────────────────────

const FORBIDDEN_ITEM_WORDS = new Set([
  'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes',
  'sábado', 'sabado', 'domingo',
  'hoy', 'mañana', 'manana',
  'para', 'por', 'en', 'el', 'la', 'los', 'las', 'de', 'del', 'al', 'con', 'sin',
  'comprar', 'compras', 'lista',
  'supermercado', 'minimarket', 'farmacia', 'feria', 'mercado',
]);

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
  checklist_items: string[];
  tags: string[];
  confidence: number;
  reason: string;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export function isValidRadarType(v: unknown): v is string {
  return typeof v === 'string' && VALID_RADAR_TYPES.has(v);
}

export function isValidSurface(v: unknown): v is string {
  return typeof v === 'string' && VALID_SURFACES.has(v);
}

export function isValidPriority(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && VALID_PRIORITIES.has(v));
}

export function isValidStatus(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && VALID_STATUSES.has(v));
}

export function clampConfidence(v: unknown): number {
  if (typeof v !== 'number' || !isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export function sanitizeChecklistItems(
  items: unknown[],
  storeContext: string | null,
): string[] {
  const storeWords: Set<string> = storeContext
    ? new Set(storeContext.toLowerCase().split(/\s+/).filter(Boolean))
    : new Set();

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2) continue;
    const lower = trimmed.toLowerCase();
    if (FORBIDDEN_ITEM_WORDS.has(lower)) continue;
    // Remove if every word of the item appears in the store_context
    const words = lower.split(/\s+/);
    if (storeWords.size > 0 && words.every((w) => storeWords.has(w))) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(trimmed);
    if (result.length >= 30) break;
  }

  return result;
}

export function validateRadarResult(data: unknown): RadarResult | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;

  if (!isValidRadarType(d.type)) return null;
  if (typeof d.title !== 'string' || !d.title.trim()) return null;
  if (!Array.isArray(d.checklist_items)) return null;

  const storeCtx = typeof d.store_context === 'string' ? d.store_context : null;
  const confidence = clampConfidence(d.confidence);

  return {
    type: d.type,
    surface: isValidSurface(d.surface) ? (d.surface as string) : 'notes',
    title: (d.title as string).trim(),
    summary: typeof d.summary === 'string' ? d.summary : null,
    date_text: typeof d.date_text === 'string' ? d.date_text : null,
    time: typeof d.time === 'string' ? d.time : null,
    amount:
      typeof d.amount === 'number' && isFinite(d.amount) && d.amount >= 0
        ? d.amount
        : null,
    currency: d.currency === 'CLP' ? 'CLP' : null,
    priority: isValidPriority(d.priority)
      ? ((d.priority ?? null) as 'low' | 'normal' | 'urgent' | null)
      : null,
    status: isValidStatus(d.status)
      ? ((d.status ?? null) as 'pending' | 'paid' | 'completed' | null)
      : null,
    store_context: storeCtx,
    checklist_items: sanitizeChecklistItems(d.checklist_items as unknown[], storeCtx),
    tags: Array.isArray(d.tags)
      ? (d.tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [],
    confidence,
    reason: typeof d.reason === 'string' ? d.reason : '',
  };
}

// ─── Type mapping ─────────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, EntryType> = {
  note: 'note',
  task: 'task',
  shopping_list: 'shopping_list',
  payment: 'payment',
  health: 'health',
  pet: 'pet',
  calendar: 'appointment',
  home: 'task',
};

function mapStoreType(ctx: string | null): StoreType {
  if (!ctx) return 'otro';
  const lower = ctx.toLowerCase();
  if (lower.includes('farmacia')) return 'farmacia';
  if (lower.includes('super') || lower.includes('minimarket')) return 'supermercado';
  if (lower.includes('feria') || lower.includes('mercado')) return 'feria';
  return 'otro';
}

// ─── Entry builder ────────────────────────────────────────────────────────────

export function radarToEntry(radar: RadarResult, rawText: string): ParsedEntry {
  const type: EntryType = TYPE_MAP[radar.type] ?? 'note';
  const tokens = parseTokens(rawText);

  const tags: string[] = [type];
  if (radar.priority === 'urgent') tags.push('urgente');

  // ShoppingMetadata: ONLY for shopping_list.
  // pet/health use ChecklistItem records directly — no listKind:'shopping' to prevent
  // those entries from leaking into /purchases (which filters on metadata.listKind).
  let metadata: ParsedEntry['metadata'];
  if (type === 'shopping_list' && radar.checklist_items.length > 0) {
    const shoppingMeta: ShoppingMetadata = {
      listKind: 'shopping',
      storeType: mapStoreType(radar.store_context),
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
    amount: radar.amount ?? tokens.amount ?? undefined,
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

export async function radarIntake(text: string): Promise<RadarResult | null> {
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

    const validated = validateRadarResult(data);
    if (!validated) return null;
    if (validated.confidence < 0.75) return null;

    return validated;
  } catch {
    return null;
  }
}
