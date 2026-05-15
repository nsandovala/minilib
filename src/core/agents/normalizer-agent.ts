import type { EntryType, ParsedEntry, ShoppingMetadata } from '@/types';
import type { ExtractedTokens } from './parser-agent';
import { resolveListEntryType } from './parser-rules';

const TYPE_PATTERNS: Record<EntryType, RegExp[]> = {
  payment: [
    /\b(pagar|pago|abonar|cobrar|factura|cuenta|internet|luz|agua|gas|arriendo|hipoteca|tarjeta|prestamo|préstamo)\b/i,
  ],
  pet: [
    /\b(mascota|perro|gato|veterinario|vet|vacuna|comida\s+(para|del?)|correa|areno|alimento\s+(para|del?))\b/i,
    /\b(thor|luna|max|michis|firulais|pelud)\b/i,
  ],
  health: [
    /\b(remedio|medicamento|medicina|pastilla|jarabe|dosis|tomar\s+(remedio|medicina|pastilla)|vitamina|insulina|presion|presión|temperatura|malestar|dolor)\b/i,
  ],
  appointment: [
    /\b(cita|doctor|doctora|médico|medico|consulta|dentista|oftalmólogo|oftalmologo|dermatólogo|dermatologo|examen|laboratorio|cirugia|cirugía)\b/i,
  ],
  reminder: [
    /\b(recordar|recordatorio|acordarse|no\s+olvidar|alerta|avisar)\b/i,
  ],
  task: [
    /\b(comprar|llevar|sacar|hacer|limpiar|lavar|cocinar|preparar|arreglar|revisar|cambiar|ir\s+a|pasar\s+por|buscar|entregar|devolver|agendar)\b/i,
  ],
  note: [],
  shopping_list: [],
};

export function detectType(tokens: ExtractedTokens): EntryType {
  const lower = tokens.rawText.toLowerCase();

  if (tokens.isListLike) {
    return resolveListEntryType(tokens.detectedTags);
  }

  const priorityOrder: EntryType[] = [
    'payment',
    'pet',
    'health',
    'appointment',
    'reminder',
    'task',
  ];

  for (const type of priorityOrder) {
    const patterns = TYPE_PATTERNS[type];
    for (const pattern of patterns) {
      if (pattern.test(lower)) return type;
    }
  }

  return 'note';
}

function buildTitle(tokens: ExtractedTokens, type: EntryType): string {
  if (tokens.isListLike) {
    if (type === 'health') return 'Compra de farmacia';
    if (tokens.detectedTags.includes('mascotas')) return 'Lista para mascotas';
    if (tokens.detectedTags.includes('farmacia')) return 'Lista de farmacia';
    if (tokens.detectedTags.includes('aseo hogar') || tokens.detectedTags.includes('casa')) {
      return 'Lista para la casa';
    }
    return 'Lista de compras';
  }

  // Use cleanedText: date/time/amount are already stripped, so the verb stays intact.
  // e.g. "comprar cilantro mañana" → cleanedText = "comprar cilantro" → "Comprar cilantro"
  const base = tokens.cleanedText.trim() || tokens.rawText.trim();
  if (!base) return tokens.rawText.trim();

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (type === 'shopping_list') {
    return cap(base);
  }
  if (type === 'payment' && !/\bpagar?\b/i.test(base)) {
    return `Pagar ${base}`;
  }
  if (type === 'health' && !/\b(tomar|aplicar|poner)\b/i.test(base)) {
    return `Tomar ${base}`;
  }

  return cap(base);
}

function buildTags(rawText: string, type: EntryType): string[] {
  const tags: string[] = [type];
  const lower = rawText.toLowerCase();

  if (/\b(urgente|urgencia|importante|prioridad|ya|inmediato)\b/i.test(lower)) {
    tags.push('urgente');
  }
  if (/\b(semanal|cada\s+semana|todos\s+los\s+días|diario|diaria)\b/i.test(lower)) {
    tags.push('recurrente');
  }

  return tags;
}

function buildShoppingMetadata(tokens: ExtractedTokens): ShoppingMetadata | undefined {
  if (!tokens.shoppingList) return undefined;

  return {
    listKind: tokens.shoppingList.listKind,
    storeType: tokens.shoppingList.storeType,
    items: tokens.shoppingList.items,
    progress: tokens.shoppingList.progress,
  };
}

export function normalizeEntry(tokens: ExtractedTokens): ParsedEntry {
  const type = detectType(tokens);
  const title = buildTitle(tokens, type);
  const tags = Array.from(new Set([...buildTags(tokens.rawText, type), ...tokens.detectedTags]));
  const metadata = buildShoppingMetadata(tokens);

  // For shopping lists, use total estimated as the entry-level amount
  // instead of the first extracted number (which may be an item price).
  const shoppingTotal =
    metadata && metadata.listKind === 'shopping' && metadata.progress.totalEstimated > 0
      ? metadata.progress.totalEstimated
      : undefined;

  return {
    text: tokens.rawText,
    type,
    title,
    date: tokens.date ?? undefined,
    time: tokens.time ?? undefined,
    tags,
    amount: shoppingTotal ?? tokens.amount ?? undefined,
    checklistItems: tokens.checklistItems.length ? tokens.checklistItems : undefined,
    listItems: tokens.listItems.length ? tokens.listItems : undefined,
    listGroups: tokens.listGroups.length ? tokens.listGroups : undefined,
    detectedTags: tokens.detectedTags.length ? tokens.detectedTags : undefined,
    metadata,
  };
}
