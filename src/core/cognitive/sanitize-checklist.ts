/**
 * Checklist sanitizer — single source of truth for cleaning checklist items.
 *
 * Rules:
 *   - Remove dates, store names, prepositions, and connector words
 *   - Remove duplicates (case-insensitive)
 *   - Remove items shorter than 2 characters
 *   - Remove non-strings
 *   - Cap at 30 items
 *   - If the AI returned empty items, attempt to extract from raw text by splitting
 *     on commas, semicolons, "y", and whitespace — WITHOUT requiring a whitelist.
 *
 * Used by:
 *   - normalize-radar-result.ts (heuristic classification)
 *   - tests/radar-intake.test.mjs
 */

export const DATE_WORDS = new Set([
  'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes',
  'sábado', 'sabado', 'domingo', 'hoy', 'mañana', 'manana',
]);

export const FORBIDDEN_ITEM_WORDS = new Set([
  ...Array.from(DATE_WORDS),
  'pasado', 'comprar', 'compra', 'compras', 'lista', 'total',
  'supermercado', 'super', 'minimarket', 'farmacia', 'feria', 'mercado',
  'botillería', 'botilleria', 'mall', 'chino', 'panadería', 'panaderia',
  'carnicería', 'carniceria', 'verdulería', 'verduleria',
  'para', 'por', 'en', 'el', 'la', 'los', 'las', 'de', 'del', 'al', 'con', 'sin',
  'un', 'una', 'unos', 'unas', 'uno', 'y', 'o', 'con', 'sin', 'al', 'del',
  'lo', 'le', 'les', 'me', 'te', 'se', 'lo', 'la', 'los', 'las',
  'ir', 'voy', 'vas', 'va', 'vamos', 'van', 'fui', 'fue', 'ire', 'iré', 'ira', 'irá',
]);

function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function stripTotal(text: string): { text: string; possibleTotal: number | null } {
  const match = text.match(/\btotal\s+\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/i);
  if (!match) return { text, possibleTotal: null };
  const raw = Number(match[1].replace(/\./g, '').replace(',', '.'));
  const possibleTotal = Number.isFinite(raw) && raw > 0 ? raw : null;
  return {
    text: text.replace(match[0], ' ').replace(/\s+/g, ' ').trim(),
    possibleTotal,
  };
}

function parseMoneyCandidate(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return null;
  const normalized = raw.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/**
 * Sanitize an array of checklist items.
 *
 * @param items        Raw items (usually from AI response)
 * @param storeType    Detected store type (to exclude store name from items)
 * @param rawText      Original user text (fallback extraction if items array is empty)
 * @returns            Cleaned items + possible total extracted from text
 */
export function sanitizeChecklistItems(
  items: unknown[],
  storeType: string,
  rawText: string,
): { items: string[]; possibleTotal: number | null } {
  const seen = new Set<string>();
  const result: string[] = [];
  let possibleTotal: number | null = null;

  // First pass: clean provided items
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    let item = stripTotal(raw).text.trim();
    if (stripTotal(raw).possibleTotal !== null) {
      possibleTotal = stripTotal(raw).possibleTotal;
    }

    item = item.replace(/^(?:comprar|compra|compras|lista|en|para|de|del|al)\s+/i, '').trim();
    const lower = normalizeText(item);

    if (!lower || lower.length < 2) continue;
    if (FORBIDDEN_ITEM_WORDS.has(lower) || lower === storeType) continue;
    if (/^total\b/i.test(lower) || /\btotal\s+\d/i.test(lower)) continue;
    if (DATE_WORDS.has(lower)) continue;
    if (seen.has(lower)) continue;

    seen.add(lower);
    result.push(item);
    if (result.length >= 30) break;
  }

  if (result.length > 0) {
    return { items: result, possibleTotal };
  }

  // Fallback: extract from raw text by splitting on separators
  const withoutTotal = stripTotal(rawText);
  if (withoutTotal.possibleTotal !== null) {
    possibleTotal = withoutTotal.possibleTotal;
  }

  const cleanedText = withoutTotal.text
    .replace(/\b(?:hoy|mañana|manana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, ' ')
    .replace(/\b(?:comprar|compra|compras|lista|en|el|la|los|las|de|del|al|para|por|supermercado|super|minimarket|farmacia|feria|mercado|botiller[ií]a|mall\s*chino|mall|panader[ií]a|carnicer[ií]a|verduler[ií]a)\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const extractedItems = cleanedText
    .split(/\s+y\s+|[,;/]|\s+/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
    .filter((item) => !FORBIDDEN_ITEM_WORDS.has(normalizeText(item)));

  for (const item of extractedItems) {
    const lower = normalizeText(item);
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(item);
    if (result.length >= 30) break;
  }

  return { items: result, possibleTotal };
}
