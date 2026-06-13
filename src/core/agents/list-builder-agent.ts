import type { ShoppingItem, ShoppingProgress } from '@/types';
import { normalizeCLP } from '../../lib/money.ts';
import { hasExplicitListIntent, shouldBuildShoppingList, hasProjectIntent, hasShoppingIntent } from './parser-rules.ts';

export interface ShoppingListBuildResult {
  listKind: 'shopping';
  storeType: 'supermercado' | 'farmacia' | 'feria' | 'minimarket' | 'botilleria' | 'mall' | 'mall_chino' | 'panaderia' | 'carniceria' | 'verduleria' | 'otro';
  items: ShoppingItem[];
  progress: ShoppingProgress;
  detectedTags: string[];
}

/* ──────────────────────────────────────────
   Intro cleaning
   ────────────────────────────────────────── */

const INTRO_PATTERNS = [
  /\bcompra\s+en\s+(?:el\s+|la\s+)?(?:super(?:mercado)?|mercado|minimarket|feria|farmacia|botiller[ií]a|mall\s*chino|mall|tabaquer[ií]a|ferreter[ií]a|verduler[ií]a|carnicer[ií]a|panader[ií]a|almac[eé]n|despensa)\b/gi,
  /\bcomprar\s+en\s+(?:el\s+|la\s+)?(?:super(?:mercado)?|mercado|minimarket|feria|farmacia|botiller[ií]a|mall\s*chino|mall|tabaquer[ií]a|ferreter[ií]a|verduler[ií]a|carnicer[ií]a|panader[ií]a|almac[eé]n|despensa)\b/gi,
  /\bcomprar\s+en\s+(?:el\s+)?(?:super(?:mercado)?|mercado)\b/gi,
  /\bcompras\s+(?:para\s+)?(?:el\s+)?(?:super(?:mercado)?|mercado)\b/gi,
  /\bcompras\s+(?:en\s+)?(?:la\s+)?(?:feria|farmacia|minimarket|super(?:mercado)?|mercado|botiller[ií]a|mall\s*chino|mall|tabaquer[ií]a|ferreter[ií]a|verduler[ií]a|carnicer[ií]a|panader[ií]a|almac[eé]n|despensa)\b/gi,
  /\blista\s+(?:de\s+)?(?:compras|supermercado|super)\b/gi,
  /\blista\s+supermercado\b/gi,
  /\bnecesito\s+(?:comprar|traer)\b/gi,
  /\bpasar\s+al\s+(?:super(?:mercado)?|mercado|minimarket|almac[eé]n|farmacia|feria|botiller[ií]a|mall\s*chino|mall|tabaquer[ií]a|ferreter[ií]a|verduler[ií]a|carnicer[ií]a|panader[ií]a)\s+por\b/gi,
  /\bpasar\s+al\s+(?:super(?:mercado)?|mercado)\s+por\b/gi,
  /\btraer\s+(?:de\s+)?(?:el\s+)?(?:super(?:mercado)?|mercado)\b/gi,
  /\bir\s+a\s+(?:comprar|el\s+super|el\s+mercado)\b/gi,
  /\bcomprar\b/gi,
  // Store at end of list: "pan leche en minimarket" → "pan leche"
  /\s+en\s+(?:el\s+|la\s+)?(?:super(?:mercado)?|mercado|minimarket|feria|farmacia|botiller[ií]a|mall\s*chino|mall|tabaquer[ií]a|ferreter[ií]a|verduler[ií]a|carnicer[ií]a|panader[ií]a|almac[eé]n|despensa)\b/gi,
  /\bcompras\b/gi,
  /\bsupermercado\b/gi,
  /\bminimarket\b/gi,
  /\bbotiller[ií]a\b/gi,
  /\bmall\s*chino\b/gi,
  /\bmall\b/gi,
  /\bferreter[ií]a\b/gi,
  /\bdespensa\b/gi,
  /\bfarmacia\b/gi,
  /\bverduler[ií]a\b/gi,
  /\bcarnicer[ií]a\b/gi,
  /\bpanader[ií]a\b/gi,
  /\btabaquer[ií]a\b/gi,
  /\balmac[eé]n\b/gi,
  /\ben\s+el\s+super\b/gi,
  /\blista\s+de\b/gi,
];

function cleanShoppingIntro(text: string): string {
  let cleaned = text;
  for (const pattern of INTRO_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

/* ──────────────────────────────────────────
   Store type detection
   ────────────────────────────────────────── */

const STORE_TYPE_PATTERNS: { pattern: RegExp; type: ShoppingListBuildResult['storeType'] }[] = [
  { pattern: /\bmall\s*chino\b/i, type: 'mall_chino' },
  { pattern: /\bminimarket\b/i, type: 'minimarket' },
  { pattern: /\b(supermercado|super|en\s+el\s+super|en\s+el\s+supermercado)\b/i, type: 'supermercado' },
  { pattern: /\bferia\b/i, type: 'feria' },
  { pattern: /\bfarmacia\b/i, type: 'farmacia' },
  { pattern: /\bbotiller[ií]a\b/i, type: 'botilleria' },
  { pattern: /\bmall\b/i, type: 'mall' },
  { pattern: /\bpanader[ií]a\b/i, type: 'panaderia' },
  { pattern: /\bcarnicer[ií]a\b/i, type: 'carniceria' },
  { pattern: /\bverduler[ií]a\b/i, type: 'verduleria' },
];

function detectStoreType(text: string): ShoppingListBuildResult['storeType'] {
  for (const rule of STORE_TYPE_PATTERNS) {
    if (rule.pattern.test(text)) return rule.type;
  }
  return 'otro';
}

/* ──────────────────────────────────────────
   Item normalization
   ────────────────────────────────────────── */

function normalizeListItem(item: string): string {
  return item
    .replace(/^[,.\-\s]+/, '')
    .replace(/[,\.\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE_ITEM_PATTERNS = [
  /^(?:en\s+la\s+feria|en\s+(?:el\s+|la\s+)?(?:super(?:mercado)?|mercado|minimarket|farmacia|tabaquer[ií]a|ferreter[ií]a|verduler[ií]a|carnicer[ií]a|panader[ií]a|almac[eé]n|despensa))$/i,
  /^(?:compra\s+en|comprar\s+en|compras?\s+en|compras?)$/i,
  /^(?:para|por|en|de|con|a|al|el|la|los|las|un|una|del)$/i,
];

function stripTemporalTail(label: string): string {
  return label
    .replace(/\s+\btotal\s+\$?\s*\d[\d.,]*\b.*$/i, '')
    .replace(/\s+\bpara\s+(?:el\s+|la\s+)?(?:hoy|mañana|manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b.*$/i, '')
    .replace(/\s+\b(?:el\s+|la\s+)?(?:hoy|mañana|manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b.*$/i, '')
    .replace(/\s+\bpara(?:\s+(?:el|la))?\s*$/i, '')
    .trim();
}

function sanitizeItemLabel(item: string): string {
  let cleaned = normalizeListItem(item);
  cleaned = cleaned.replace(/^(?:compra\s+en|comprar\s+en|compras?\s+en)\s+/i, '');
  cleaned = cleaned.replace(/^(?:pasar\s+al?\s+)?(?:super(?:mercado)?|mercado|minimarket|farmacia|feria|botiller[ií]a|mall\s*chino|mall|tabaquer[ií]a|ferreter[ií]a|verduler[ií]a|carnicer[ií]a|panader[ií]a|almac[eé]n|despensa)\s+por\s+/i, '');
  cleaned = cleaned.replace(/^(?:en\s+la\s+feria|en\s+(?:el\s+|la\s+)?(?:super(?:mercado)?|mercado|minimarket|farmacia|botiller[ií]a|mall\s*chino|mall|tabaquer[ií]a|ferreter[ií]a|verduler[ií]a|carnicer[ií]a|panader[ií]a|almac[eé]n|despensa))\b[,:]?\s*/i, '');
  cleaned = cleaned.replace(/^(?:por|para|en|de|con|a|al|el|la|los|las|un|una|del)\s+/i, '');
  cleaned = stripTemporalTail(cleaned);
  cleaned = normalizeListItem(cleaned);
  return cleaned;
}

function isNoiseItem(label: string): boolean {
  if (!label) return true;
  return NOISE_ITEM_PATTERNS.some((pattern) => pattern.test(label));
}

/* ──────────────────────────────────────────
   Item details: price, quantity, unit
   ────────────────────────────────────────── */

const UNIT_ALIASES: Record<string, string> = {
  un: 'un', ud: 'un', uds: 'un', unidad: 'un', unidades: 'un',
  kg: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gr: 'g', gramo: 'g', gramos: 'g',
  lt: 'lt', l: 'lt', litro: 'lt', litros: 'lt',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  caja: 'caja', cajas: 'caja',
  paquete: 'paquete', paquetes: 'paquete',
  bolsa: 'bolsa', bolsas: 'bolsa',
  lata: 'lata', latas: 'lata',
  botella: 'botella', botellas: 'botella',
  pack: 'pack', packs: 'pack', sixpack: 'pack',
};

function parseItemDetails(rawLabel: string): Omit<ShoppingItem, 'id' | 'category' | 'checked'> {
  let remaining = rawLabel.trim();
  let amount: number | undefined;
  let quantity: string | undefined;
  let unit: string | undefined;

  // 1. Extract trailing price: "pan 2.900", "coca cola $1.650", "agua 1500"
  const pricePattern = /^(.*?)\s+(\$?\d{1,3}(?:[.,]\d{3})*(?:\s*(?:k|lucas?))?)\s*$/i;
  const priceMatch = remaining.match(pricePattern);
  if (priceMatch) {
    const candidate = priceMatch[1].trim();
    const rawPrice = priceMatch[2].trim();
    const parsed = normalizeCLP(rawPrice);
    if (parsed !== null && parsed >= 100) {
      amount = parsed;
      remaining = candidate;
    }
  }

  // 2. Extract quantity + unit from remaining: "leche 2 lt", "arroz 1 kg"
  const qtyPattern = /^(.*?)\s+(\d+(?:[.,]\d+)?)\s*(un|uds?|kg|g|gr|lt|l|ml|cajas?|paquetes?|bolsas?|latas?|botellas?|packs?|sixpack)\s*$/i;
  const qtyMatch = remaining.match(qtyPattern);
  if (qtyMatch) {
    quantity = qtyMatch[2].trim().replace(',', '.');
    const rawUnit = qtyMatch[3].trim().toLowerCase();
    unit = UNIT_ALIASES[rawUnit] ?? rawUnit;
    remaining = qtyMatch[1].trim();
  }

  return { label: remaining, amount, quantity, unit };
}

/* ──────────────────────────────────────────
   Item → category classification
   ────────────────────────────────────────── */

const ITEM_CATEGORY_MAP: Record<string, string> = {
  // lácteos
  leche: 'lácteos',
  yogurt: 'lácteos',
  yogur: 'lácteos',
  queso: 'lácteos',
  mantequilla: 'lácteos',
  crema: 'lácteos',
  'leche condensada': 'lácteos',

  // despensa
  huevos: 'despensa',
  arroz: 'despensa',
  fideos: 'despensa',
  pasta: 'despensa',
  azúcar: 'despensa',
  azucar: 'despensa',
  harina: 'despensa',
  aceite: 'despensa',
  sal: 'despensa',
  pimienta: 'despensa',
  sopa: 'despensa',
  legumbres: 'despensa',
  lentejas: 'despensa',
  garbanzos: 'despensa',
  porotos: 'despensa',
  arvejas: 'despensa',
  avena: 'despensa',
  cereal: 'despensa',
  mermelada: 'despensa',
  miel: 'despensa',
  mayonesa: 'despensa',
  mostaza: 'despensa',
  ketchup: 'despensa',
  salsa: 'despensa',
  atún: 'despensa',
  atun: 'despensa',
  sardinas: 'despensa',

  // frutas/verduras
  tomate: 'frutas/verduras',
  palta: 'frutas/verduras',
  paltas: 'frutas/verduras',
  lechuga: 'frutas/verduras',
  cebolla: 'frutas/verduras',
  choclo: 'frutas/verduras',
  choclos: 'frutas/verduras',
  papas: 'frutas/verduras',
  papa: 'frutas/verduras',
  zanahoria: 'frutas/verduras',
  zanahorias: 'frutas/verduras',
  pepino: 'frutas/verduras',
  apio: 'frutas/verduras',
  brócoli: 'frutas/verduras',
  brocoli: 'frutas/verduras',
  coliflor: 'frutas/verduras',
  espinaca: 'frutas/verduras',
  acelga: 'frutas/verduras',
  repollo: 'frutas/verduras',
  plátano: 'frutas/verduras',
  platano: 'frutas/verduras',
  manzana: 'frutas/verduras',
  pera: 'frutas/verduras',
  naranja: 'frutas/verduras',
  limón: 'frutas/verduras',
  limon: 'frutas/verduras',
  limones: 'frutas/verduras',
  sandía: 'frutas/verduras',
  sandia: 'frutas/verduras',
  melón: 'frutas/verduras',
  melon: 'frutas/verduras',
  uva: 'frutas/verduras',
  durazno: 'frutas/verduras',
  frutas: 'frutas/verduras',
  verduras: 'frutas/verduras',
  naranjas: 'frutas/verduras',
  peras: 'frutas/verduras',
  manzanas: 'frutas/verduras',
  platanos: 'frutas/verduras',

  // carnes
  carne: 'carnes',
  carnes: 'carnes',
  pollo: 'carnes',
  vacuno: 'carnes',
  cerdo: 'carnes',
  pescado: 'carnes',
  salmón: 'carnes',
  salmon: 'carnes',
  caldo: 'carnes',
  caldos: 'carnes',

  // panadería
  pan: 'panadería',
  hallulla: 'panadería',
  marraqueta: 'panadería',
  baguette: 'panadería',
  colizas: 'panadería',
  tortillas: 'panadería',
  'pan integral': 'panadería',
  'pan de molde': 'panadería',

  // aseo
  confort: 'aseo',
  papel: 'aseo',
  cloro: 'aseo',
  detergente: 'aseo',
  lavaloza: 'aseo',
  jabón: 'aseo',
  jabon: 'aseo',
  shampoo: 'aseo',
  acondicionador: 'aseo',
  'pasta dental': 'aseo',
  cepillo: 'aseo',
  desodorante: 'aseo',
  pañales: 'aseo',
  paniales: 'aseo',
  toallas: 'aseo',
  servilletas: 'aseo',
  bolsas: 'aseo',
  esponja: 'aseo',
  'papel higiénico': 'aseo',
  'papel higienico': 'aseo',
  limpiavidrios: 'aseo',
  desinfectante: 'aseo',
  suavizante: 'aseo',
  'jabón de baño': 'aseo',

  // bebestibles
  agua: 'bebestibles',
  jugo: 'bebestibles',
  bebida: 'bebestibles',
  bebidas: 'bebestibles',
  refresco: 'bebestibles',
  gaseosa: 'bebestibles',
  coca: 'bebestibles',
  cerveza: 'bebestibles',
  vino: 'bebestibles',
  té: 'bebestibles',
  te: 'bebestibles',
  café: 'bebestibles',
  cafe: 'bebestibles',
  'jugo natural': 'bebestibles',

  // farmacia
  paracetamol: 'farmacia',
  ibuprofeno: 'farmacia',
  aspirina: 'farmacia',
  vitamina: 'farmacia',
  vitaminas: 'farmacia',
  remedio: 'farmacia',
  medicamento: 'farmacia',
  pastilla: 'farmacia',
  jarabe: 'farmacia',
  pomada: 'farmacia',
  gotas: 'farmacia',
  curita: 'farmacia',
  vendas: 'farmacia',
  alcohol: 'farmacia',
  gasa: 'farmacia',
  antibiótico: 'farmacia',
  antibiotico: 'farmacia',
  anticonceptivo: 'farmacia',
  'alcohol gel': 'farmacia',
  'suero oral': 'farmacia',

  // ferretería
  tornillo: 'ferretería',
  tornillos: 'ferretería',
  perno: 'ferretería',
  pernos: 'ferretería',
  clavo: 'ferretería',
  clavos: 'ferretería',
  huincha: 'ferretería',
  martillo: 'ferretería',
  brocha: 'ferretería',
  rodillo: 'ferretería',
  pintura: 'ferretería',
  cinta: 'ferretería',
  aisladora: 'ferretería',
  'cinta aisladora': 'ferretería',
  ampolleta: 'ferretería',
  ampolletas: 'ferretería',
  pila: 'ferretería',
  pilas: 'ferretería',
  bateria: 'ferretería',
  batería: 'ferretería',

  // mascotas
  correa: 'mascotas',
  collar: 'mascotas',
  juguete: 'mascotas',
  snack: 'mascotas',
  premio: 'mascotas',
  pipeta: 'mascotas',
  desparasitario: 'mascotas',
  'comida perro': 'mascotas',
  'comida gato': 'mascotas',
  'alimento perro': 'mascotas',
  'alimento gato': 'mascotas',
  'arena gato': 'mascotas',
  'shampoo perro': 'mascotas',
  arena: 'mascotas',
};

function classifyItemCategory(label: string): string {
  const normalized = label.toLowerCase().trim();
  const singular = normalized.replace(/s$/, '');

  if (ITEM_CATEGORY_MAP[normalized]) return ITEM_CATEGORY_MAP[normalized];
  if (ITEM_CATEGORY_MAP[singular]) return ITEM_CATEGORY_MAP[singular];

  // Word-level matching: prevents short keys like "sal", "te", "pan" from matching
  // inside unrelated words like "salud", "integraciones", "pantalla".
  const words = normalized.split(/\s+/);
  for (const word of words) {
    if (ITEM_CATEGORY_MAP[word]) return ITEM_CATEGORY_MAP[word];
    const ws = word.replace(/s$/, '');
    if (ITEM_CATEGORY_MAP[ws]) return ITEM_CATEGORY_MAP[ws];
  }

  // Substring matching only for multi-word phrase keys (e.g. "pan integral", "pasta dental")
  for (const [key, category] of Object.entries(ITEM_CATEGORY_MAP)) {
    if (key.includes(' ') && normalized.includes(key)) return category;
  }

  return 'otros';
}

// Split "papas tomates" → ["papas", "tomates"] when both are individually known products.
function splitAdjacentKnown(part: string): string[] {
  const words = part.split(/\s+/);
  if (words.length < 2 || words.length > 5) return [part];
  if (words.every((w) => classifyItemCategory(w) !== 'otros')) return words;

  for (let splitAt = 1; splitAt < words.length; splitAt += 1) {
    const left = words.slice(0, splitAt).join(' ');
    const right = words.slice(splitAt).join(' ');
    if (classifyItemCategory(left) !== 'otros' && classifyItemCategory(right) !== 'otros') {
      return [left, right];
    }
  }

  return [part];
}

/* ──────────────────────────────────────────
   Tag detection (semantic groups)
   ────────────────────────────────────────── */

const TAG_RULES = [
  { pattern: /\bfrutas?\b/i, tag: 'frutas' },
  { pattern: /\bverduras?\b/i, tag: 'verduras' },
  { pattern: /\b(lacteos|lácteos|leche|yogurt|yogur|queso)\b/i, tag: 'lácteos' },
  { pattern: /\b(carnes?|pollo|vacuno|cerdo|pescado)\b/i, tag: 'carnes' },
  { pattern: /\b(panaderia|panadería|pan|bolleria|bollería|hallulla|marraqueta)\b/i, tag: 'panadería' },
  { pattern: /\b(aseo|limpieza|detergente|cloro|desinfectante|papel higienico|papel higiénico|articulos de aseo|artículos de aseo|confort|papel|lavaloza)\b/i, tag: 'aseo hogar' },
  { pattern: /\b(farmacia|remedio|medicina|pastilla|vitamina)\b/i, tag: 'farmacia' },
  { pattern: /\b(mascota|perro|gato|arena|comida para mascota|alimento para mascota)\b/i, tag: 'mascotas' },
  { pattern: /\b(despensa|arroz|fideos|legumbres|aceite|harina|azucar|azúcar|huevos)\b/i, tag: 'despensa' },
  { pattern: /\b(casa|hogar)\b/i, tag: 'casa' },
  { pattern: /\b(bebida|bebidas|jugo|agua)\b/i, tag: 'bebestibles' },
  { pattern: /\b(tornillos?|pernos?|clavos?|cinta\s+aisladora|pintura|ampolletas?|pilas?)\b/i, tag: 'ferretería' },
];

function detectTags(items: string[]): string[] {
  const matched = new Set<string>();
  for (const item of items) {
    const lower = item.toLowerCase();
    for (const rule of TAG_RULES) {
      if (rule.pattern.test(lower)) {
        matched.add(rule.tag);
      }
    }
  }
  return Array.from(matched);
}

/* ──────────────────────────────────────────
   Helpers
   ────────────────────────────────────────── */

function buildProgress(items: ShoppingItem[]): ShoppingProgress {
  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const totalEstimated = items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const totalChecked = items.filter((i) => i.checked).reduce((sum, i) => sum + (i.amount ?? 0), 0);
  return { total, checked, totalEstimated, totalChecked };
}

/* ──────────────────────────────────────────
   Public API
   ────────────────────────────────────────── */

/**
 * Deterministic shopping-list builder.
 * Turns messy grocery/household input into a structured shopping list.
 * Returns `null` when the input does not look like a list.
 */
export function buildShoppingList(input: string): ShoppingListBuildResult | null {
  const raw = input.trim();
  // Project/integration notes must never be classified as shopping lists
  if (hasProjectIntent(raw)) return null;
  const cleaned = cleanShoppingIntro(raw);
  const explicitListIntent = hasExplicitListIntent(raw);

  const parts = cleaned
    .split(/[,;/]|\s+y\s+|\n+/i)
    .map(sanitizeItemLabel)
    .filter(Boolean)
    .filter((label) => !isNoiseItem(label))
    .flatMap(splitAdjacentKnown);

  const storeFromRaw = detectStoreType(raw);
  const hasStoreKeyword = /\b(supermercado|super|mercado|minimarket|feria|farmacia|botiller[ií]a|mall\s*chino|mall|panader[ií]a|carnicer[ií]a|verduler[ií]a|ferreter[ií]a|despensa)\b/i.test(raw);

  const storeNameSet = new Set(['supermercado', 'super', 'feria', 'farmacia', 'minimarket', 'botillería', 'botilleria', 'mall', 'mall chino', 'panadería', 'panaderia', 'carnicería', 'carniceria', 'verdulería', 'verduleria', 'ferretería', 'ferreteria', 'despensa']);
  const firstPartLower = parts[0]?.toLowerCase() ?? '';
  const isFirstPartStore = storeNameSet.has(firstPartLower);

  let itemLabels = parts;
  if (isFirstPartStore && parts.length >= 2) {
    itemLabels = parts.slice(1);
  }

  const hasKnownCategory = itemLabels.some((l) => classifyItemCategory(l) !== 'otros');
  if (!shouldBuildShoppingList({
    itemCount: itemLabels.length,
    explicitListIntent,
    hasStoreKeyword,
    hasKnownCategory,
    hasShoppingIntent: hasShoppingIntent(raw),
  })) return null;

  const storeType = storeFromRaw !== 'otro' ? storeFromRaw : detectStoreType(cleaned);

  const items: ShoppingItem[] = itemLabels.map((rawLabel) => {
    const details = parseItemDetails(rawLabel);
    const sanitizedLabel = sanitizeItemLabel(details.label);
    return {
      id: crypto.randomUUID(),
      label: sanitizedLabel,
      category: classifyItemCategory(sanitizedLabel),
      checked: false,
      amount: details.amount,
      quantity: details.quantity,
      unit: details.unit,
    };
  }).filter((item) => !isNoiseItem(item.label));

  const detectedTags = detectTags(items.map((i) => i.label));

  return {
    listKind: 'shopping',
    storeType,
    items,
    progress: buildProgress(items),
    detectedTags,
  };
}
