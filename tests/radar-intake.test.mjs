import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeuristicRadarResult, normalizeRadarResult } from '../src/core/cognitive/normalize-radar-result.ts';

// ─── Inline mirrors of src/lib/radar.ts pure logic ───────────────────────────
// (Cannot import TypeScript files that use @/ aliases directly in Node test runner)

const VALID_RADAR_TYPES = new Set([
  'note', 'task', 'shopping_list', 'payment', 'health', 'pet', 'calendar', 'home',
]);
const VALID_SURFACES = new Set([
  'notes', 'todos', 'purchases', 'payments', 'health', 'pets', 'calendar', 'appointments', 'home',
]);
const VALID_PRIORITIES = new Set(['low', 'normal', 'urgent']);
const VALID_STATUSES = new Set(['pending', 'paid', 'completed']);

const FORBIDDEN_ITEM_WORDS = new Set([
  'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes',
  'sábado', 'sabado', 'domingo',
  'hoy', 'mañana', 'manana',
  'para', 'por', 'en', 'el', 'la', 'los', 'las', 'de', 'del', 'al', 'con', 'sin',
  'comprar', 'compras', 'lista',
  'supermercado', 'minimarket', 'farmacia', 'feria', 'mercado',
]);

const TYPE_MAP = {
  note: 'note', task: 'task', shopping_list: 'shopping_list',
  payment: 'payment', health: 'health', pet: 'pet',
  calendar: 'appointment', home: 'task',
};

function clampConfidence(v) {
  if (typeof v !== 'number' || !isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function sanitizeChecklistItems(items, storeContext) {
  const storeWords = storeContext
    ? new Set(storeContext.toLowerCase().split(/\s+/).filter(Boolean))
    : new Set();
  const seen = new Set();
  const result = [];
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2) continue;
    const lower = trimmed.toLowerCase();
    if (FORBIDDEN_ITEM_WORDS.has(lower)) continue;
    const words = lower.split(/\s+/);
    if (storeWords.size > 0 && words.every(w => storeWords.has(w))) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(trimmed);
    if (result.length >= 30) break;
  }
  return result;
}

function isValidRadarType(v) { return typeof v === 'string' && VALID_RADAR_TYPES.has(v); }
function isValidSurface(v)    { return typeof v === 'string' && VALID_SURFACES.has(v); }
function isValidPriority(v)   { return v === null || v === undefined || (typeof v === 'string' && VALID_PRIORITIES.has(v)); }
function isValidStatus(v)     { return v === null || v === undefined || (typeof v === 'string' && VALID_STATUSES.has(v)); }

function validateRadarResult(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (!isValidRadarType(data.type)) return null;
  if (typeof data.title !== 'string' || !data.title.trim()) return null;
  if (!Array.isArray(data.checklist_items)) return null;

  const storeCtx = typeof data.store_context === 'string' ? data.store_context : null;
  const confidence = clampConfidence(data.confidence);

  return {
    type: data.type,
    surface: isValidSurface(data.surface) ? data.surface : 'notes',
    title: data.title.trim(),
    summary: typeof data.summary === 'string' ? data.summary : null,
    date_text: typeof data.date_text === 'string' ? data.date_text : null,
    time: typeof data.time === 'string' ? data.time : null,
    amount: typeof data.amount === 'number' && isFinite(data.amount) && data.amount >= 0 ? data.amount : null,
    currency: data.currency === 'CLP' ? 'CLP' : null,
    priority: isValidPriority(data.priority) ? (data.priority ?? null) : null,
    status: isValidStatus(data.status) ? (data.status ?? null) : null,
    store_context: storeCtx,
    checklist_items: sanitizeChecklistItems(data.checklist_items, storeCtx),
    tags: Array.isArray(data.tags) ? data.tags.filter(t => typeof t === 'string') : [],
    confidence,
    reason: typeof data.reason === 'string' ? data.reason : '',
  };
}

// ─── checklistItems + metadata policy (mirrors radarToEntry) ─────────────────

function getEntryPolicy(type, checklist_items) {
  const acceptsChecklist = type === 'shopping_list' || type === 'pet' || type === 'health';
  const hasShoppingMeta = type === 'shopping_list' && checklist_items.length > 0;
  return {
    checklistItems: acceptsChecklist && checklist_items.length > 0 ? checklist_items : undefined,
    hasShoppingMetadata: hasShoppingMeta,
  };
}

// ─── Sanitizer tests ──────────────────────────────────────────────────────────

test('sanitizer elimina días y conectores', () => {
  const result = sanitizeChecklistItems(['sábado', 'pan', 'queso', 'para', 'bebida'], null);
  assert.deepEqual(result, ['pan', 'queso', 'bebida']);
});

test('sanitizer elimina store_context cuando coincide exactamente', () => {
  const result = sanitizeChecklistItems(['farmacia', 'cepillo de dientes', 'pregabalina'], 'farmacia');
  assert.ok(!result.includes('farmacia'));
  assert.ok(result.includes('cepillo de dientes'));
  assert.ok(result.includes('pregabalina'));
});

test('sanitizer elimina duplicados', () => {
  const result = sanitizeChecklistItems(['pan', 'Pan', 'pan'], null);
  assert.equal(result.length, 1);
  assert.equal(result[0], 'pan');
});

test('sanitizer elimina strings vacíos y muy cortos', () => {
  const result = sanitizeChecklistItems(['', ' ', 'a', 'pan'], null);
  assert.deepEqual(result, ['pan']);
});

test('sanitizer filtra items no-string', () => {
  const result = sanitizeChecklistItems([42, null, 'pan', { label: 'queso' }], null);
  assert.deepEqual(result, ['pan']);
});

test('sanitizer limita a 30 ítems', () => {
  const many = Array.from({ length: 50 }, (_, i) => `item${i}`);
  const result = sanitizeChecklistItems(many, null);
  assert.equal(result.length, 30);
});

test('sanitizer: jueves y para no son ítems', () => {
  const result = sanitizeChecklistItems(
    ['cepillo de dientes', 'pregabalina', 'para', 'jueves'],
    'farmacia',
  );
  assert.ok(!result.includes('para'));
  assert.ok(!result.includes('jueves'));
  assert.ok(result.includes('cepillo de dientes'));
  assert.ok(result.includes('pregabalina'));
});

// ─── validateRadarResult ──────────────────────────────────────────────────────

test('validateRadarResult: schema inválido — type desconocido', () => {
  const result = validateRadarResult({ type: 'compras', title: 'test', confidence: 0.9, checklist_items: [] });
  assert.equal(result, null);
});

test('validateRadarResult: schema inválido — title vacío', () => {
  const result = validateRadarResult({ type: 'note', title: '', confidence: 0.9, checklist_items: [] });
  assert.equal(result, null);
});

test('validateRadarResult: schema inválido — checklist_items no array', () => {
  const result = validateRadarResult({ type: 'note', title: 'ok', confidence: 0.9, checklist_items: 'pan' });
  assert.equal(result, null);
});

test('validateRadarResult: confidence 3.5 queda clampado a 1', () => {
  const result = validateRadarResult({ type: 'note', title: 'ok', confidence: 3.5, checklist_items: [] });
  assert.ok(result !== null);
  assert.equal(result.confidence, 1);
});

test('validateRadarResult: confidence -0.5 queda clampado a 0', () => {
  const result = validateRadarResult({ type: 'note', title: 'ok', confidence: -0.5, checklist_items: [] });
  assert.ok(result !== null);
  assert.equal(result.confidence, 0);
});

test('validateRadarResult: amount negativo queda null', () => {
  const result = validateRadarResult({ type: 'payment', title: 'pago', confidence: 0.9, checklist_items: [], amount: -5000 });
  assert.ok(result !== null);
  assert.equal(result.amount, null);
});

test('validateRadarResult: priority inválida queda null', () => {
  const result = validateRadarResult({ type: 'note', title: 'ok', confidence: 0.9, checklist_items: [], priority: 'alta' });
  assert.ok(result !== null);
  assert.equal(result.priority, null);
});

test('validateRadarResult: surface inválida queda notes', () => {
  const result = validateRadarResult({ type: 'note', title: 'ok', confidence: 0.9, checklist_items: [], surface: 'unknown' });
  assert.ok(result !== null);
  assert.equal(result.surface, 'notes');
});

test('validateRadarResult: null devuelve null', () => {
  assert.equal(validateRadarResult(null), null);
  assert.equal(validateRadarResult(undefined), null);
  assert.equal(validateRadarResult([]), null);
});

// ─── checklistItems / metadata policy ────────────────────────────────────────

test('shopping_list: tiene ShoppingMetadata y checklistItems', () => {
  const items = ['pan', 'queso'];
  const policy = getEntryPolicy('shopping_list', items);
  assert.ok(policy.hasShoppingMetadata);
  assert.deepEqual(policy.checklistItems, items);
});

test('pet: tiene checklistItems, NO ShoppingMetadata', () => {
  const items = ['pastilla'];
  const policy = getEntryPolicy('pet', items);
  assert.ok(!policy.hasShoppingMetadata);
  assert.deepEqual(policy.checklistItems, items);
});

test('health: tiene checklistItems, NO ShoppingMetadata', () => {
  const items = ['remedio A', 'vitamina C'];
  const policy = getEntryPolicy('health', items);
  assert.ok(!policy.hasShoppingMetadata);
  assert.deepEqual(policy.checklistItems, items);
});

test('note con items alucinados: NO checklistItems, NO ShoppingMetadata', () => {
  const items = ['pan', 'queso'];
  const policy = getEntryPolicy('note', items);
  assert.ok(!policy.hasShoppingMetadata);
  assert.equal(policy.checklistItems, undefined);
});

test('payment con items: NO checklistItems', () => {
  const policy = getEntryPolicy('payment', ['item raro']);
  assert.equal(policy.checklistItems, undefined);
  assert.ok(!policy.hasShoppingMetadata);
});

// ─── TYPE_MAP ─────────────────────────────────────────────────────────────────

test('type mapping: calendar → appointment', () => {
  assert.equal(TYPE_MAP['calendar'], 'appointment');
});

test('type mapping: home → task', () => {
  assert.equal(TYPE_MAP['home'], 'task');
});

test('type mapping: tipo desconocido → fallback note', () => {
  assert.equal(TYPE_MAP['xyz'] ?? 'note', 'note');
});

// ─── Contratos Zod centrales: casos críticos pre-producción ──────────────────

test('[zod-1] pago google one 21000 → payment con monto y tags', () => {
  const result = buildHeuristicRadarResult('pago google one 21000');
  assert.equal(result.type, 'payment');
  assert.equal(result.amount, 21000);
  assert.ok(result.tags.includes('payment'));
  assert.ok(result.tags.includes('expense'));
});

test('[zod-2] buscar vuelos diciembre 2026 → no interpreta año como monto', () => {
  const result = buildHeuristicRadarResult('buscar vuelos para diciembre 2026 para luna de miel');
  assert.ok(result.type === 'task' || result.type === 'note');
  assert.equal(result.amount, null);
  assert.notEqual(result.type, 'payment');
});

test('[zod-3] sábado comprar pan leche bebida → shopping_list con sábado preservado', () => {
  const result = buildHeuristicRadarResult('sábado comprar pan leche bebida');
  assert.equal(result.type, 'shopping_list');
  assert.deepEqual(result.checklist_items, ['pan', 'leche', 'bebida']);
  assert.equal(result.date_text, 'sábado');
  assert.equal(result.dateISO, null);
  assert.equal(result.amount, null);
});

test('[zod-4] comprar pan leche bebida en minimarket → storeType minimarket', () => {
  const result = buildHeuristicRadarResult('comprar pan leche bebida en minimarket');
  assert.equal(result.type, 'shopping_list');
  assert.equal(result.storeType, 'minimarket');
  assert.deepEqual(result.checklist_items, ['pan', 'leche', 'bebida']);
});

test('[zod-5] médico miércoles a las 15:30 → cita/salud sin monto', () => {
  const result = buildHeuristicRadarResult('médico miércoles a las 15:30');
  assert.ok(result.type === 'appointment' || result.type === 'health');
  assert.equal(result.time, '15:30');
  assert.equal(result.amount, null);
  assert.notEqual(result.type, 'payment');
});

test('[zod-6] hora veterinaria para saly sábado 15:30 → pet o appointment con tag pet', () => {
  const result = buildHeuristicRadarResult('hora veterinaria para saly sábado 15:30');
  assert.ok(result.type === 'pet' || result.type === 'appointment');
  if (result.type === 'appointment') assert.ok(result.tags.includes('pet'));
  assert.equal(result.time, '15:30');
  assert.equal(result.amount, null);
});

test('[zod-7] pago mensualidad escuela hijo 15.000 → payment 15000', () => {
  const result = buildHeuristicRadarResult('pago mensualidad escuela hijo 15.000');
  assert.equal(result.type, 'payment');
  assert.equal(result.amount, 15000);
});

test('[zod-8] total de compra no contamina items', () => {
  const result = normalizeRadarResult({
    type: 'shopping_list',
    surface: 'purchases',
    title: 'Compra',
    checklist_items: ['choclos total 7330'],
    amount: 7330,
  }, 'choclos total 7330');

  assert.equal(result.ok, true);
  assert.deepEqual(result.data?.checklist_items, ['choclos']);
  assert.equal(result.data?.amount, null);
  assert.equal(result.data?.metadata.possibleTotal, 7330);
});

// ─── Casos de uso completos (mock de respuesta IA) ───────────────────────────

test('caso 1: sábado comprar pan, bebida, helado → shopping_list sin sábado como ítem', () => {
  const radar = validateRadarResult({
    type: 'shopping_list',
    surface: 'purchases',
    title: 'Compras del sábado',
    checklist_items: ['sábado', 'pan', 'bebida', 'helado'],
    date_text: 'sábado',
    store_context: null,
    confidence: 0.92,
    reason: 'shopping intent with day context',
    tags: [],
  });
  assert.ok(radar !== null);
  assert.equal(radar.type, 'shopping_list');
  assert.equal(radar.date_text, 'sábado');
  assert.ok(!radar.checklist_items.includes('sábado'), '"sábado" no debe ser ítem');
  assert.ok(!radar.checklist_items.includes('comprar'));
  assert.deepEqual(radar.checklist_items, ['pan', 'bebida', 'helado']);
  assert.ok(radar.confidence >= 0.75);
});

test('caso 2: compras farmacia cepillo de dientes pregabalina para el jueves', () => {
  const radar = validateRadarResult({
    type: 'shopping_list',
    surface: 'purchases',
    title: 'Compras en farmacia',
    checklist_items: ['cepillo de dientes', 'pregabalina', 'para', 'jueves'],
    date_text: 'jueves',
    store_context: 'farmacia',
    confidence: 0.91,
    reason: 'farmacia context + item list',
    tags: [],
  });
  assert.ok(radar !== null);
  assert.equal(radar.store_context, 'farmacia');
  assert.equal(radar.date_text, 'jueves');
  assert.ok(!radar.checklist_items.includes('para'));
  assert.ok(!radar.checklist_items.includes('jueves'));
  assert.ok(!radar.checklist_items.includes('farmacia'));
  assert.deepEqual(radar.checklist_items, ['cepillo de dientes', 'pregabalina']);
  assert.ok(radar.confidence >= 0.75);
});

test('caso 3: ir al médico sábado 15:00 urgente → health, no calendar', () => {
  const radar = validateRadarResult({
    type: 'health',
    surface: 'health',
    title: 'Ir al médico',
    checklist_items: [],
    date_text: 'sábado',
    time: '15:00',
    priority: 'urgent',
    confidence: 0.93,
    reason: 'medical appointment with urgency',
    tags: [],
  });
  assert.ok(radar !== null);
  assert.equal(TYPE_MAP[radar.type], 'health');
  assert.notEqual(TYPE_MAP[radar.type], 'appointment');
  assert.equal(radar.time, '15:00');
  assert.equal(radar.priority, 'urgent');
  assert.ok(radar.confidence >= 0.75);
});

test('caso 4: pastilla para la gata Luna lunes 9am → pet, no calendar', () => {
  const radar = validateRadarResult({
    type: 'pet',
    surface: 'pets',
    title: 'Pastilla para la gata Luna',
    checklist_items: ['lunes'],
    date_text: 'lunes',
    time: '09:00',
    confidence: 0.90,
    reason: 'pet care action with pet name',
    tags: [],
  });
  assert.ok(radar !== null);
  assert.equal(TYPE_MAP[radar.type], 'pet');
  assert.notEqual(TYPE_MAP[radar.type], 'appointment');
  // 'lunes' debe ser filtrado del sanitizer
  assert.ok(!radar.checklist_items.includes('lunes'));
  assert.ok(radar.confidence >= 0.75);
  const policy = getEntryPolicy('pet', radar.checklist_items);
  assert.ok(!policy.hasShoppingMetadata, 'pet no debe tener ShoppingMetadata');
});

test('caso 5: herramientas para conectar con Liev → note', () => {
  const radar = validateRadarResult({
    type: 'note',
    surface: 'notes',
    title: 'Drive, Gmail, Photos, Notion, GitHub herramientas para conectar con Liev',
    checklist_items: [],
    date_text: null,
    confidence: 0.88,
    reason: 'abstract conceptual list without action intent',
    tags: [],
  });
  assert.ok(radar !== null);
  assert.equal(TYPE_MAP[radar.type], 'note');
  assert.notEqual(TYPE_MAP[radar.type], 'shopping_list');
  const policy = getEntryPolicy('note', radar.checklist_items);
  assert.equal(policy.checklistItems, undefined);
  assert.ok(!policy.hasShoppingMetadata);
  assert.ok(radar.confidence >= 0.75);
});

test('caso 6: pagar internet 12990 hoy → payment con amount', () => {
  const radar = validateRadarResult({
    type: 'payment',
    surface: 'payments',
    title: 'Pagar internet',
    checklist_items: [],
    date_text: 'hoy',
    amount: 12990,
    currency: 'CLP',
    status: 'pending',
    confidence: 0.95,
    reason: 'explicit payment verb + amount + service',
    tags: [],
  });
  assert.ok(radar !== null);
  assert.equal(TYPE_MAP[radar.type], 'payment');
  assert.equal(radar.amount, 12990);
  assert.equal(radar.currency, 'CLP');
  assert.ok(radar.confidence >= 0.75);
});

// ─── Fallback y flag ──────────────────────────────────────────────────────────

test('confidence < 0.75 activaría fallback', () => {
  const radar = validateRadarResult({ type: 'note', title: 'algo', confidence: 0.5, checklist_items: [] });
  assert.ok(radar !== null);
  assert.ok(radar.confidence < 0.75, 'confidence bajo → caller debe usar fallback');
});

test('confidence clampeado a 0 es < 0.75 → fallback', () => {
  const radar = validateRadarResult({ type: 'note', title: 'ok', confidence: -2, checklist_items: [] });
  assert.ok(radar !== null);
  assert.equal(radar.confidence, 0);
  assert.ok(radar.confidence < 0.75);
});

test('null activa fallback', () => {
  const CONFIDENCE_THRESHOLD = 0.75;
  const radar = null;
  const shouldFallback = !(radar && radar.confidence >= CONFIDENCE_THRESHOLD);
  assert.ok(shouldFallback);
});

// ─── Inline mirrors of normalizeRadarCandidate (route.ts) ─────────────────────

const FINANCIAL_KEYWORDS_TEST = [
  '$', 'clp', 'peso', 'pesos', 'luca', 'lucas', 'mil',
  'pagar', 'pago', 'mensualidad', 'cuenta', 'deuda', 'transferencia',
  'depositar', 'cobrar', 'vale', 'costó', 'costo', 'comprar por',
];

const STORE_PATTERNS_TEST = [
  [/mall\s*chino/i,  'mall_chino'],
  [/minimarket/i,    'minimarket'],
  [/supermercado/i,  'supermercado'],
  [/\bsuper\b/i,     'supermercado'],
  [/farmacia/i,      'farmacia'],
  [/botiller[ií]a/i, 'botilleria'],
  [/panader[ií]a/i,  'panaderia'],
  [/carnizer[ií]a/i, 'carniceria'],
  [/verduler[ií]a/i, 'verduleria'],
  [/\bferia\b/i,     'feria'],
  [/\bmall\b/i,      'mall'],
];

const TYPE_TO_SURFACE_TEST = {
  shopping_list: 'purchases', payment: 'payments', calendar: 'appointments',
  health: 'health', pet: 'pets', note: 'notes', task: 'todos', home: 'home',
};

const CHECKLIST_DATE_STORE_WORDS_TEST = new Set([
  'sábado', 'sabado', 'domingo', 'lunes', 'martes', 'miércoles', 'miercoles',
  'jueves', 'viernes', 'mañana', 'manana', 'hoy', 'pasado',
  'comprar', 'compra', 'compras', 'lista',
  'supermercado', 'minimarket', 'farmacia', 'feria',
  'botillería', 'botilleria', 'mall', 'panadería', 'panaderia',
  'carnicería', 'carniceria', 'verdulería', 'verduleria',
  'en', 'para', 'de', 'del', 'al', 'el', 'la',
]);

function hasFinancialContextTest(text) {
  const lower = text.toLowerCase();
  return FINANCIAL_KEYWORDS_TEST.some(kw => lower.includes(kw));
}

function inferStoreContextTest(rawText, existing) {
  for (const [pattern, name] of STORE_PATTERNS_TEST) {
    if (pattern.test(rawText)) return name;
  }
  return existing;
}

function normalizeRadarCandidateTest(raw, rawText) {
  const c = { ...raw };
  if (typeof c.amount === 'string') {
    const n = Number(c.amount.replace(/\./g, '').replace(',', '.'));
    c.amount = isFinite(n) && n >= 0 ? n : null;
  }
  if (typeof c.amount === 'number' && c.amount >= 1900 && c.amount <= 2100 && !hasFinancialContextTest(rawText)) {
    c.amount = null;
    c.currency = null;
  }
  const type = typeof c.type === 'string' ? c.type : 'note';
  if (TYPE_TO_SURFACE_TEST[type]) c.surface = TYPE_TO_SURFACE_TEST[type];
  c.store_context = inferStoreContextTest(rawText, typeof c.store_context === 'string' ? c.store_context : null);
  if (Array.isArray(c.checklist_items)) {
    c.checklist_items = c.checklist_items.filter(item => {
      if (typeof item !== 'string') return false;
      const lower = item.trim().toLowerCase();
      return lower.length >= 2 && !CHECKLIST_DATE_STORE_WORDS_TEST.has(lower);
    });
  }
  if (!c.title || typeof c.title !== 'string' || !c.title.trim()) {
    c.title = rawText.slice(0, 100);
  }
  return c;
}

// ─── Test cases A-D — normalización defensiva ─────────────────────────────────

test('A: año 2026 no se convierte en amount sin contexto financiero', () => {
  const candidate = {
    type: 'note', surface: 'notes', title: 'Buscar vuelos luna de miel',
    checklist_items: [], amount: 2026, currency: 'CLP', confidence: 0.7, reason: '', tags: [],
  };
  const normalized = normalizeRadarCandidateTest(candidate, 'buscar vuelos diciembre 2026 para luna de miel');
  assert.equal(normalized.amount, null, 'año 2026 debe quedar null');
  assert.equal(normalized.currency, null);
  assert.notEqual(normalized.type, 'payment');
});

test('B: sábado y minimarket no son checklist_items', () => {
  const candidate = {
    type: 'shopping_list', surface: 'purchases', title: 'Compras del sábado',
    checklist_items: ['sábado', 'pan', 'leche', 'bebida', 'en', 'minimarket'],
    date_text: 'sábado', store_context: 'minimarket', confidence: 0.92, reason: '', tags: [],
  };
  const normalized = normalizeRadarCandidateTest(candidate, 'sábado comprar pan leche bebida en minimarket');
  assert.equal(normalized.type, 'shopping_list');
  assert.equal(normalized.surface, 'purchases');
  assert.equal(normalized.date_text, 'sábado');
  assert.equal(normalized.store_context, 'minimarket');
  assert.ok(!normalized.checklist_items.includes('sábado'), '"sábado" no debe ser ítem');
  assert.ok(!normalized.checklist_items.includes('minimarket'), '"minimarket" no debe ser ítem');
  assert.ok(!normalized.checklist_items.includes('en'), '"en" no debe ser ítem');
  assert.ok(normalized.checklist_items.includes('pan'));
  assert.ok(normalized.checklist_items.includes('leche'));
  assert.ok(normalized.checklist_items.includes('bebida'));
  assert.notEqual(normalized.date_text, 'domingo');
});

test('C: string "15.000" se coerciona a 15000 con contexto financiero', () => {
  const candidate = {
    type: 'payment', surface: 'payments', title: 'Pago mensualidad',
    checklist_items: [], amount: '15.000', currency: 'CLP', confidence: 0.92, reason: '', tags: [],
  };
  const normalized = normalizeRadarCandidateTest(candidate, 'pago mensualidad escuela hijo 15.000');
  assert.equal(normalized.type, 'payment');
  assert.equal(normalized.surface, 'payments');
  assert.equal(normalized.amount, 15000, '"15.000" debe coercionarse a 15000');
  assert.equal(normalized.currency, 'CLP');
});

test('C: amount numérico 15000 se preserva con contexto financiero', () => {
  const candidate = {
    type: 'payment', surface: 'payments', title: 'Pago mensualidad',
    checklist_items: [], amount: 15000, currency: 'CLP', confidence: 0.92, reason: '', tags: [],
  };
  const normalized = normalizeRadarCandidateTest(candidate, 'pago mensualidad escuela hijo 15.000');
  assert.equal(normalized.amount, 15000, 'amount 15000 debe preservarse');
});

test('D: gym el miércoles → surface appointments, amount null, time preservado', () => {
  const candidate = {
    type: 'calendar', surface: 'calendar', title: 'Ir al gym',
    checklist_items: [], date_text: 'miércoles', time: '19:30', amount: null, confidence: 0.88, reason: '', tags: [],
  };
  const normalized = normalizeRadarCandidateTest(candidate, 'ir al gym el miércoles desde las 19:30');
  assert.notEqual(normalized.type, 'payment');
  assert.equal(normalized.time, '19:30');
  assert.equal(normalized.amount, null);
  assert.equal(normalized.surface, 'appointments', 'surface "calendar" debe corregirse a "appointments"');
});
