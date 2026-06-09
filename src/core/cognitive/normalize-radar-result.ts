import { RadarCardSchema, type ContractEntryType, type ContractStoreType, type RadarCardContract } from '../contracts/card-contracts.ts';
import { hasHealthIntent, hasPaymentIntent, hasPetAction, hasShoppingIntent, isLongFormNote } from '../agents/parser-rules.ts';

const TYPE_TO_SURFACE: Record<ContractEntryType, RadarCardContract['surface']> = {
  shopping_list: 'purchases',
  payment: 'payments',
  calendar: 'appointments',
  appointment: 'appointments',
  health: 'health',
  pet: 'pets',
  note: 'notes',
  task: 'todos',
};

const STORE_PATTERNS: { pattern: RegExp; type: ContractStoreType }[] = [
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

const DATE_WORDS = new Set([
  'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes',
  'sábado', 'sabado', 'domingo', 'hoy', 'mañana', 'manana',
]);

const FORBIDDEN_ITEM_WORDS = new Set([
  'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes',
  'sábado', 'sabado', 'domingo', 'hoy', 'mañana', 'manana',
  'pasado', 'comprar', 'compra', 'compras', 'lista', 'total',
  'supermercado', 'super', 'minimarket', 'farmacia', 'feria', 'mercado',
  'botillería', 'botilleria', 'mall', 'chino', 'panadería', 'panaderia',
  'carnicería', 'carniceria', 'verdulería', 'verduleria',
  'para', 'por', 'en', 'el', 'la', 'los', 'las', 'de', 'del', 'al', 'con', 'sin',
]);

const COMMON_ITEMS = new Set([
  'pan', 'leche', 'bebida', 'bebidas', 'huevos', 'arroz', 'fideos', 'aceite',
  'azúcar', 'azucar', 'sal', 'queso', 'yogurt', 'tomate', 'tomates', 'papas',
  'lechuga', 'cebolla', 'choclos', 'choclo', 'carne', 'pollo', 'jamón', 'jamon',
]);

function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function inferDateText(text: string): string | null {
  const match = text.match(/\b(hoy|mañana|manana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function inferTime(text: string): string | null {
  const match = text.match(/\b(?:a\s+las?|a\s+la|al|desde\s+las?)?\s*(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3]?.toLowerCase();
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function hasFinancialContext(text: string): boolean {
  return /\$|\b(clp|pesos?|lucas?|pagar|pago|mensualidad|cuenta|factura|abonar|transferir|cobrar|vale|cost[oó]|suscripci[oó]n)\b/i.test(text);
}

function looksLikeYearInDateContext(text: string, amount: number): boolean {
  if (amount < 1900 || amount > 2100) return false;
  const yearPattern = new RegExp(`\\b${amount}\\b`);
  if (!yearPattern.test(text)) return false;
  return /\b(año|ano|fecha|diciembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|viaje|vuelos?)\b/i.test(normalizeText(text))
    || !hasFinancialContext(text);
}

function parseMoneyCandidate(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return null;
  const normalized = raw.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function inferMoney(text: string): number | null {
  if (!hasFinancialContext(text)) return null;
  const match = text.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/);
  const amount = parseMoneyCandidate(match?.[1]);
  if (amount === null || looksLikeYearInDateContext(text, amount)) return null;
  return amount;
}

function normalizeMoney(rawText: string, rawAmount: unknown): number | null {
  const amount = parseMoneyCandidate(rawAmount) ?? inferMoney(rawText);
  if (amount === null) return null;
  if (looksLikeYearInDateContext(rawText, amount)) return null;
  if (new RegExp(`\\b${amount}\\b\\s*:\\s*\\d{2}\\b`).test(rawText)) return null;
  return amount;
}

function inferStoreType(text: string, existing: unknown): ContractStoreType {
  for (const rule of STORE_PATTERNS) {
    if (rule.pattern.test(text)) return rule.type;
  }
  if (typeof existing === 'string' && RadarCardSchema.shape.storeType.safeParse(existing).success) {
    return existing as ContractStoreType;
  }
  return 'otro';
}

function stripTotal(text: string): { text: string; possibleTotal: number | null } {
  const match = text.match(/\btotal\s+\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/i);
  const possibleTotal = parseMoneyCandidate(match?.[1]);
  return {
    text: match ? text.replace(match[0], ' ').replace(/\s+/g, ' ').trim() : text,
    possibleTotal,
  };
}

function sanitizeChecklistItems(items: unknown[], storeType: ContractStoreType, rawText: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    let item = stripTotal(raw).text.trim();
    item = item.replace(/^(?:comprar|compra|compras|lista|en|para|de|del|al)\s+/i, '').trim();
    const lower = item.toLowerCase();
    if (!lower || lower.length < 2) continue;
    if (FORBIDDEN_ITEM_WORDS.has(lower) || lower === storeType) continue;
    if (/^total\b/i.test(lower) || /\btotal\s+\d/i.test(lower)) continue;
    if (DATE_WORDS.has(lower)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(item);
    if (result.length >= 30) break;
  }

  if (result.length > 0) return result;

  const withoutTotal = stripTotal(rawText).text
    .replace(/\b(?:hoy|mañana|manana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, ' ')
    .replace(/\b(?:comprar|compra|compras|lista|en|el|la|los|las|de|del|al|para|por|supermercado|super|minimarket|farmacia|feria|mercado|botiller[ií]a|mall\s*chino|mall|panader[ií]a|carnicer[ií]a|verduler[ií]a)\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutTotal
    .split(/\s+y\s+|[,;/]|\s+/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && !FORBIDDEN_ITEM_WORDS.has(item.toLowerCase()))
    .filter((item) => COMMON_ITEMS.has(item.toLowerCase()))
    .filter((item) => {
      const lower = item.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
}

function inferType(text: string, candidateType: unknown, items: string[]): ContractEntryType {
  const lower = normalizeText(text);
  if (hasShoppingIntent(text) && items.length > 0) return 'shopping_list';
  if ((hasPaymentIntent(text) || /\bpago\b/.test(lower)) && normalizeMoney(text, null) !== null) return 'payment';
  if (hasPetAction(text)) return 'pet';
  if (hasHealthIntent(text)) return /\b(hora|cita|consulta|medico|doctor|dentista|kine)\b/.test(lower) ? 'appointment' : 'health';
  if (/\b(reunion|cumpleanos|cumpleaños|cita|hora|agenda|agendar)\b/.test(lower)) return 'calendar';
  if (/\b(buscar|hacer|llevar|sacar|revisar|comprar)\b/.test(lower)) return 'task';
  if (typeof candidateType === 'string' && RadarCardSchema.shape.type.safeParse(candidateType).success) {
    return candidateType as ContractEntryType;
  }
  return 'note';
}

export function normalizeRadarResult(raw: unknown, rawText: string): {
  ok: boolean;
  data: RadarCardContract | null;
  fallbackUsed: boolean;
  issues: string[];
} {
  const candidate = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
  const total = stripTotal(rawText).possibleTotal;
  const storeType = inferStoreType(rawText, candidate.storeType ?? candidate.store_context);
  const items = sanitizeChecklistItems(
    Array.isArray(candidate.checklist_items) ? candidate.checklist_items : [],
    storeType,
    rawText,
  );
  const type = inferType(rawText, candidate.type, items);
  const amount = type === 'payment' ? normalizeMoney(rawText, candidate.amount) : null;

  const normalized = {
    ...candidate,
    type,
    surface: TYPE_TO_SURFACE[type],
    title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title : rawText.slice(0, 100),
    summary: typeof candidate.summary === 'string' ? candidate.summary : null,
    date_text: typeof candidate.date_text === 'string' && candidate.date_text.trim() ? candidate.date_text.trim() : inferDateText(rawText),
    dateISO: null,
    time: typeof candidate.time === 'string' ? candidate.time : inferTime(rawText),
    amount,
    currency: amount !== null ? 'CLP' : null,
    store_context: storeType === 'otro' ? (typeof candidate.store_context === 'string' ? candidate.store_context : null) : storeType,
    storeType,
    checklist_items: type === 'shopping_list' || type === 'pet' || type === 'health' ? items : [],
    tags: Array.from(new Set([
      ...(Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === 'string') : []),
      type,
      ...(type === 'payment' ? ['payment', 'expense'] : []),
      ...(type === 'pet' ? ['pet'] : []),
    ])),
    confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 0.78,
    reason: typeof candidate.reason === 'string' ? candidate.reason : 'normalized-contract',
    metadata: {
      ...(candidate.metadata && typeof candidate.metadata === 'object' && !Array.isArray(candidate.metadata) ? candidate.metadata : {}),
      possibleTotal: total,
      shoppingCompletion: {
        totalCompra: null,
        linkedEntryId: null,
        source: null,
      },
    },
  };

  const result = RadarCardSchema.safeParse(normalized);
  return {
    ok: result.success,
    data: result.success ? result.data : null,
    fallbackUsed: Object.keys(candidate).length === 0,
    issues: result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}

function computeHeuristicConfidence(text: string, type: ContractEntryType, items: string[], amount: number | null, storeType: ContractStoreType): number {
  const lower = text.toLowerCase();

  // Casos claros: confidence alto
  if (type === 'shopping_list') {
    const hasStore = storeType !== 'otro';
    const hasExplicitList = /\blista\b|[,;/]|\s+y\s+/i.test(text);
    if (items.length >= 3 && hasStore && hasExplicitList) return 0.92;
    if (items.length >= 2 && (hasStore || hasExplicitList)) return 0.88;
    if (items.length >= 2) return 0.85;
    if (items.length === 1 && hasStore) return 0.82;
    return 0.75;
  }

  if (type === 'payment') {
    if (amount !== null) {
      const hasExplicitVerb = /\b(pagar|pago|mensualidad|cuenta|factura|suscripci[oó]n)\b/i.test(text);
      if (hasExplicitVerb) return 0.90;
      return 0.85;
    }
    // Payment sin monto: ambiguo
    return 0.72;
  }

  if (type === 'appointment' || type === 'calendar') {
    const hasTime = /\b\d{1,2}:\d{2}\b/.test(text);
    const hasDate = /\b(hoy|mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i.test(text);
    if (hasTime && hasDate) return 0.88;
    if (hasTime || hasDate) return 0.85;
    return 0.78;
  }

  if (type === 'health') {
    const hasTime = /\b\d{1,2}:\d{2}\b/.test(text);
    const hasDate = /\b(hoy|mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i.test(text);
    if (hasTime && hasDate) return 0.88;
    if (hasTime || hasDate) return 0.85;
    return 0.82;
  }

  if (type === 'pet') {
    const hasTime = /\b\d{1,2}:\d{2}\b/.test(text);
    const hasDate = /\b(hoy|mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i.test(text);
    if (hasTime && hasDate) return 0.88;
    if (hasTime || hasDate) return 0.85;
    return 0.82;
  }

  if (type === 'task') {
    const hasActionVerb = /\b(buscar|hacer|llevar|sacar|revisar|comprar|ir|dar)\b/i.test(text);
    const hasDate = /\b(hoy|mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i.test(text);
    if (hasActionVerb && hasDate) return 0.84;
    if (hasActionVerb) return 0.80;
    return 0.72;
  }

  // note
  if (isLongFormNote(text)) return 0.55;
  if (text.length > 120) return 0.70;
  if (hasShoppingIntent(text) || hasPaymentIntent(text) || hasHealthIntent(text) || hasPetAction(text)) return 0.65;
  return 0.80;
}

function hasYearWithoutFinancialContext(text: string): boolean {
  const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
  if (!yearMatch) return false;
  return !hasFinancialContext(text);
}

export function shouldUseAI(text: string, localResult: RadarCardContract): boolean {
  // Siempre IA para contenido largo/estructurado
  if (isLongFormNote(text)) return true;

  // Año en contexto no-financiero → riesgo de confusión amount/año
  if (hasYearWithoutFinancialContext(text)) return true;

  // Si confidence es suficiente, no usar IA
  if (localResult.confidence >= 0.82) return false;

  const lower = text.toLowerCase();

  // shopping_list sin items suficientes o sin contexto claro
  if (localResult.type === 'shopping_list') {
    if (localResult.checklist_items.length < 2) return true;
    if (localResult.storeType === 'otro' && !/\b(comprar|lista|super|mercado|feria|farmacia)\b/i.test(text)) return true;
  }

  // payment sin monto explícito
  if (localResult.type === 'payment' && localResult.amount === null) return true;

  // note con señales mixtas de otras categorías
  if (localResult.type === 'note') {
    const hasOtherSignal = hasShoppingIntent(text) || hasPaymentIntent(text) || hasHealthIntent(text) || hasPetAction(text);
    if (hasOtherSignal) return true;
  }

  // Múltiples intenciones detectadas → ambiguo
  const intentCount = [
    hasShoppingIntent(text),
    hasPaymentIntent(text),
    hasHealthIntent(text),
    hasPetAction(text),
    /\b(reunion|cumple|evento|cita|agenda|agendar|junta|partido)\b/i.test(text),
  ].filter(Boolean).length;
  if (intentCount > 1) return true;

  // Texto largo con note pero con posible intención oculta
  if (localResult.type === 'note' && text.length > 80 && /\b(para|necesito|tengo que|debo|hay que)\b/i.test(text)) return true;

  // checklist vacío cuando parece lista
  if (/\b(comprar|lista|super|mercado|feria|farmacia)\b/i.test(text) && localResult.checklist_items.length === 0) return true;

  return false;
}

export function buildHeuristicRadarResult(rawText: string): RadarCardContract {
  const normalized = normalizeRadarResult({}, rawText);
  if (!normalized.data) {
    return RadarCardSchema.parse({
      type: 'note',
      surface: 'notes',
      title: rawText.slice(0, 100),
      summary: null,
      date_text: inferDateText(rawText),
      dateISO: null,
      time: inferTime(rawText),
      amount: null,
      currency: null,
      priority: null,
      status: null,
      store_context: null,
      storeType: 'otro',
      checklist_items: [],
      tags: ['note'],
      confidence: 0.5,
      reason: 'heuristic-fallback',
      metadata: {},
    });
  }

  // Recalcular confidence basado en heurística
  const confidence = computeHeuristicConfidence(
    rawText,
    normalized.data.type,
    normalized.data.checklist_items,
    normalized.data.amount,
    normalized.data.storeType ?? 'otro',
  );

  return {
    ...normalized.data,
    confidence,
    reason: 'heuristic-local',
  };
}
