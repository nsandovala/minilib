import type { ShoppingItem, ShoppingProgress } from '@/types';
import { normalizeCLP } from '@/lib/money';

export interface ShoppingListBuildResult {
  listKind: 'shopping';
  storeType: 'supermercado' | 'feria' | 'farmacia' | 'otro';
  items: ShoppingItem[];
  progress: ShoppingProgress;
  detectedTags: string[];
}

/* ──────────────────────────────────────────
   Intro cleaning
   ────────────────────────────────────────── */

const INTRO_PATTERNS = [
  /\bcomprar\s+en\s+(?:el\s+)?(?:super(?:mercado)?|mercado)\b/gi,
  /\blista\s+(?:de\s+)?(?:compras|supermercado|super)\b/gi,
  /\bnecesito\s+(?:comprar|traer)\b/gi,
  /\bpasar\s+al\s+(?:super(?:mercado)?|mercado)\s+por\b/gi,
  /\btraer\s+(?:de\s+)?(?:el\s+)?(?:super(?:mercado)?|mercado)\b/gi,
  /\bir\s+a\s+(?:comprar|el\s+super|el\s+mercado)\b/gi,
  /\bcomprar\b/gi,
  /\bsupermercado\b/gi,
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
  { pattern: /\b(supermercado|super|en\s+el\s+super|en\s+el\s+supermercado)\b/i, type: 'supermercado' },
  { pattern: /\bferia\b/i, type: 'feria' },
  { pattern: /\bfarmacia\b/i, type: 'farmacia' },
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

  for (const [key, category] of Object.entries(ITEM_CATEGORY_MAP)) {
    if (normalized.includes(key)) return category;
  }

  return 'otros';
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
  const cleaned = cleanShoppingIntro(raw);

  const parts = cleaned
    .split(/[,;]/)
    .map(normalizeListItem)
    .filter(Boolean);

  const storeFromRaw = detectStoreType(raw);
  const hasStoreKeyword = storeFromRaw !== 'otro';

  const storeNameSet = new Set(['supermercado', 'super', 'feria', 'farmacia']);
  const firstPartLower = parts[0]?.toLowerCase() ?? '';
  const isFirstPartStore = storeNameSet.has(firstPartLower);

  let itemLabels = parts;
  if (isFirstPartStore && parts.length >= 2) {
    itemLabels = parts.slice(1);
  }

  const hasKnownCategory = itemLabels.some((l) => classifyItemCategory(l) !== 'otros');
  if (itemLabels.length < 1) return null;
  if (itemLabels.length < 2 && !hasStoreKeyword && !hasKnownCategory) return null;

  const storeType = storeFromRaw !== 'otro' ? storeFromRaw : detectStoreType(cleaned);

  const items: ShoppingItem[] = itemLabels.map((rawLabel) => {
    const details = parseItemDetails(rawLabel);
    return {
      id: crypto.randomUUID(),
      label: details.label,
      category: classifyItemCategory(details.label),
      checked: false,
      amount: details.amount,
      quantity: details.quantity,
      unit: details.unit,
    };
  });

  const detectedTags = detectTags(items.map((i) => i.label));

  return {
    listKind: 'shopping',
    storeType,
    items,
    progress: buildProgress(items),
    detectedTags,
  };
}
