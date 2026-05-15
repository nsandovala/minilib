import { buildShoppingList, type ShoppingListBuildResult } from './list-builder-agent';

export interface ExtractedTokens {
  rawText: string;
  time: string | null;
  date: string | null;
  amount: number | null;
  keywords: string[];
  cleanedText: string;
  checklistItems: string[];
  listItems: string[];
  listGroups: string[];
  detectedTags: string[];
  isListLike: boolean;
  storeType: 'supermercado' | 'feria' | 'farmacia' | 'otro' | null;
  categorizedItems: { label: string; category: string }[];
  shoppingList: ShoppingListBuildResult | null;
}

const DAY_MAP: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  domingo: 0,
};

const MONTH_MAP: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  sept: 8,
  octubre: 9,
  nov: 10,
  noviembre: 10,
  diciembre: 11,
  dic: 11,
};

function getNextDayOfWeek(dayIndex: number): string {
  const today = new Date();
  const currentDay = today.getDay();
  let diff = dayIndex - currentDay;
  if (diff <= 0) diff += 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().split('T')[0];
}

function extractTime(text: string): { time: string | null; cleaned: string } {
  // Prefix-based: "a las 9", "al 9am", "desde las 3pm"
  const match = text.match(
    /(?:a\s+las?|al?|desde)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (match) {
    let raw = match[1].trim().toLowerCase();
    const hasAmPm = /am|pm/.test(raw);
    raw = raw.replace(/\s*(am|pm)\s*/i, '');
    const parts = raw.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] ? parseInt(parts[1], 10) : 0;
    if (hasAmPm) {
      const isPm = /pm/.test(match[1].toLowerCase());
      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
    }
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const cleaned = text.replace(match[0], '').replace(/\s+/g, ' ').trim();
    return { time, cleaned };
  }

  // Bare am/pm: "9am", "3:30pm", "10am"
  const bareMatch = text.match(/\b(\d{1,2}(?::\d{2})?)\s*(am|pm)\b/i);
  if (bareMatch) {
    const parts = bareMatch[1].split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] ? parseInt(parts[1], 10) : 0;
    const isPm = /pm/i.test(bareMatch[2]);
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const cleaned = text.replace(bareMatch[0], '').replace(/\s+/g, ' ').trim();
    return { time, cleaned };
  }

  return { time: null, cleaned: text };
}

function extractDate(text: string): { date: string | null; cleaned: string } {
  const todayMatch = text.match(/\bhoy\b/i);
  if (todayMatch) {
    return {
      date: new Date().toISOString().split('T')[0],
      cleaned: text.replace(todayMatch[0], '').replace(/\s+/g, ' ').trim(),
    };
  }

  const tomorrowMatch = text.match(/\bmañana\b|\bmanana\b/i);
  if (tomorrowMatch) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      date: tomorrow.toISOString().split('T')[0],
      cleaned: text.replace(tomorrowMatch[0], '').replace(/\s+/g, ' ').trim(),
    };
  }

  const dayNameMatch = text.match(
    /\b(el)?\s*(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/i
  );
  if (dayNameMatch) {
    const dayName = dayNameMatch[2].toLowerCase();
    const dayIndex = DAY_MAP[dayName];
    if (dayIndex !== undefined) {
      return {
        date: getNextDayOfWeek(dayIndex),
        cleaned: text.replace(dayNameMatch[0], '').replace(/\s+/g, ' ').trim(),
      };
    }
  }

  const monthMatch = text.match(
    /\b(\d{1,2})\s+(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|sept|octubre|nov|noviembre|dic|diciembre)\b/i
  );
  if (monthMatch) {
    const day = parseInt(monthMatch[1], 10);
    const monthName = monthMatch[3].toLowerCase();
    const month = MONTH_MAP[monthName];
    if (month !== undefined) {
      const year = new Date().getFullYear();
      const d = new Date(year, month, day);
      if (d < new Date()) d.setFullYear(year + 1);
      return {
        date: d.toISOString().split('T')[0],
        cleaned: text.replace(monthMatch[0], '').replace(/\s+/g, ' ').trim(),
      };
    }
  }

  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return {
      date: isoMatch[1],
      cleaned: text.replace(isoMatch[0], '').replace(/\s+/g, ' ').trim(),
    };
  }

  return { date: null, cleaned: text };
}

function extractAmount(text: string): { amount: number | null; cleaned: string } {
  const lucasMatch = text.match(/(\d+(?:[.,]\d{3})?)\s*lucas?/i);
  if (lucasMatch) {
    const cleaned = text
      .replace(lucasMatch[0], '')
      .replace(/\$\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const raw = lucasMatch[1].replace(/[.,]/g, '');
    return {
      amount: parseInt(raw, 10),
      cleaned,
    };
  }

  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    const cleaned = text
      .replace(kMatch[0], '')
      .replace(/\$\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return {
      amount: Math.round(parseFloat(kMatch[1]) * 1000),
      cleaned,
    };
  }

  // CLP with dot/comma as thousands separator: "2.900", "$12.500", "220.000"
  const clpMatch = text.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+)/);
  if (clpMatch) {
    const cleaned = text
      .replace(clpMatch[0], '')
      .replace(/\$\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const raw = clpMatch[1].replace(/[.,]/g, '');
    const num = parseInt(raw, 10);
    if (num >= 100) {
      return {
        amount: num,
        cleaned,
      };
    }
  }

  // Bare 3+ digit numbers without separators
  const fullNumberMatch = text.match(/(\d{3,})/);
  if (fullNumberMatch) {
    const cleaned = text
      .replace(fullNumberMatch[0], '')
      .replace(/\$\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const num = parseInt(fullNumberMatch[1], 10);
    if (num >= 100) {
      return {
        amount: num,
        cleaned,
      };
    }
  }

  return { amount: null, cleaned: text };
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'al', 'en', 'con', 'sin', 'por', 'para',
    'que', 'se', 'no', 'lo', 'le', 'me', 'te', 'es', 'y',
    'o', 'a', 'mi', 'tu', 'su', 'hay', 'necesito', 'tengo',
    'quiero', 'debo', 'deberia', 'debería',
  ]);

  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

function extractListMetadata(text: string): {
  checklistItems: string[];
  listItems: string[];
  listGroups: string[];
  detectedTags: string[];
  isListLike: boolean;
  storeType: 'supermercado' | 'feria' | 'farmacia' | 'otro' | null;
  categorizedItems: { label: string; category: string }[];
  shoppingList: ShoppingListBuildResult | null;
} {
  const shoppingList = buildShoppingList(text);

  if (!shoppingList) {
    return {
      checklistItems: [],
      listItems: [],
      listGroups: [],
      detectedTags: [],
      isListLike: false,
      storeType: null,
      categorizedItems: [],
      shoppingList: null,
    };
  }

  const listItems = shoppingList.items.map((i) => i.label);
  const listGroups = shoppingList.detectedTags.filter((tag) => tag !== 'casa');

  return {
    checklistItems: listItems,
    listItems,
    listGroups,
    detectedTags: shoppingList.detectedTags,
    isListLike: true,
    storeType: shoppingList.storeType,
    categorizedItems: shoppingList.items.map((i) => ({ label: i.label, category: i.category })),
    shoppingList,
  };
}

export function parseTokens(rawText: string): ExtractedTokens {
  const { time, cleaned: afterTime } = extractTime(rawText);
  const { date, cleaned: afterDate } = extractDate(afterTime);

  // Build shopping list from text with only time/date stripped,
  // so item-level prices like "pan 2.900" are preserved.
  const listMeta = extractListMetadata(afterDate);

  // For shopping lists with priced items, avoid stripping the first price
  // as a global amount. Use the total estimated instead in normalizer.
  const looksLikeShoppingList = listMeta.shoppingList && listMeta.shoppingList.items.some((i) => i.amount !== undefined);

  const { amount, cleaned: afterAmount } = extractAmount(afterDate);
  const keywords = extractKeywords(afterAmount);

  return {
    rawText,
    time,
    date,
    amount: looksLikeShoppingList ? null : amount,
    keywords,
    cleanedText: afterAmount,
    checklistItems: listMeta.checklistItems,
    listItems: listMeta.listItems,
    listGroups: listMeta.listGroups,
    detectedTags: listMeta.detectedTags,
    isListLike: listMeta.isListLike,
    storeType: listMeta.storeType,
    categorizedItems: listMeta.categorizedItems,
    shoppingList: listMeta.shoppingList,
  };
}

export interface ParsedIntent {
  intent:
    | 'shopping_list'
    | 'purchase'
    | 'payment'
    | 'income'
    | 'pet'
    | 'note';
  storeType?: 'supermercado' | 'feria' | 'farmacia' | 'otro';
  items?: { label: string; category: string }[];
  title?: string;
  date?: string | null;
  time?: string | null;
  amount?: number | null;
}

export function parseEntryIntent(input: string): ParsedIntent {
  const tokens = parseTokens(input);
  const lower = input.toLowerCase();

  // Payment / Income detection
  if (/\b(pagar|pago|factura|cuenta|internet|luz|agua|gas|arriendo|hipoteca|tarjeta|prestamo|préstamo)\b/i.test(lower)) {
    return { intent: 'payment', date: tokens.date, time: tokens.time, amount: tokens.amount };
  }
  if (/\b(ingreso|sueldo|me pagaron|pagaron|venta|transferencia recibida|entró|entro|depósito|deposito)\b/i.test(lower)) {
    return { intent: 'income', date: tokens.date, time: tokens.time, amount: tokens.amount };
  }

  // Pet detection
  if (/\b(mascota|perro|gato|veterinario|vet|vacuna|comida para|alimento para|correa|arena)\b/i.test(lower)) {
    return { intent: 'pet', date: tokens.date, time: tokens.time };
  }

  // Shopping list detection
  if (tokens.isListLike && tokens.categorizedItems.length > 0) {
    const storeType = tokens.storeType ?? 'otro';
    return {
      intent: 'shopping_list',
      storeType,
      items: tokens.categorizedItems,
      title: 'Lista de compras',
      date: tokens.date,
      time: tokens.time,
    };
  }

  // Simple purchase detection
  if (/\b(comprar|compra|supermercado|feria|mercado)\b/i.test(lower)) {
    return { intent: 'purchase', date: tokens.date, time: tokens.time, amount: tokens.amount };
  }

  return { intent: 'note', date: tokens.date, time: tokens.time };
}
