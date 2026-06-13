/**
 * Store patterns — unified regex definitions for store type detection.
 *
 * Used by:
 *   - normalize-radar-result.ts (heuristic classification)
 *   - radar.ts (entry builder)
 *   - Any future store-related logic
 *
 * Keep this as the single source of truth.
 */

export type StorePattern = { pattern: RegExp; type: StorePatternType };

export const STORE_PATTERN_TYPES = [
  'mall_chino',
  'minimarket',
  'supermercado',
  'farmacia',
  'feria',
  'botilleria',
  'mall',
  'panaderia',
  'carniceria',
  'verduleria',
  'otro',
] as const;

export type StorePatternType = (typeof STORE_PATTERN_TYPES)[number];

export const STORE_PATTERNS: StorePattern[] = [
  { pattern: /\bmall\s*chino\b/i, type: 'mall_chino' },
  { pattern: /\bminimarket\b/i, type: 'minimarket' },
  { pattern: /\b(supermercado|super)\b/i, type: 'supermercado' },
  { pattern: /\bfarmacia\b/i, type: 'farmacia' },
  { pattern: /\bferia\b/i, type: 'feria' },
  { pattern: /\bbotiller[ií]a\b/i, type: 'botilleria' },
  { pattern: /\bmall\b/i, type: 'mall' },
  { pattern: /\bpanader[ií]a\b/i, type: 'panaderia' },
  { pattern: /\bcarnicer[ií]a\b/i, type: 'carniceria' },
  { pattern: /\bverduler[ií]a\b/i, type: 'verduleria' },
];

/**
 * Infer store type from raw text. Returns 'otro' if no pattern matches.
 */
export function inferStoreTypeFromText(text: string): StorePatternType {
  for (const rule of STORE_PATTERNS) {
    if (rule.pattern.test(text)) return rule.type;
  }
  return 'otro';
}

/**
 * Map a free-form store context string to a known store type.
 * Used when the store type comes from an external source (e.g. AI response)
 * rather than being detected directly from text.
 */
export function mapStoreContextToType(ctx: string | null | undefined): StorePatternType {
  if (!ctx) return 'otro';
  const lower = ctx.toLowerCase();
  if (lower.includes('mall_chino') || /mall\s*chino/.test(lower)) return 'mall_chino';
  if (lower.includes('minimarket')) return 'minimarket';
  if (lower.includes('botilleria') || lower.includes('botillería')) return 'botilleria';
  if (lower.includes('panaderia') || lower.includes('panadería')) return 'panaderia';
  if (lower.includes('carniceria') || lower.includes('carnicería')) return 'carniceria';
  if (lower.includes('verduleria') || lower.includes('verdulería')) return 'verduleria';
  if (lower.includes('farmacia')) return 'farmacia';
  if (lower.includes('super')) return 'supermercado';
  if (lower.includes('feria') || lower.includes('mercado')) return 'feria';
  if (lower.includes('mall')) return 'mall';
  return 'otro';
}
