import type { CalendarEntryMetadata, EntryType, ParsedEntry, ShoppingMetadata } from '@/types';
import type { ExtractedTokens } from './parser-agent.ts';
import { parseCalendarEventInput } from '../calendar/event-parser.ts';
import {
  resolveListEntryType,
  isLongFormNote,
  hasPetAction,
  hasHealthIntent,
  hasShoppingIntent,
  hasPaymentIntent,
  hasExpensePurchaseIntent,
  hasPassiveExpenseIntent,
  hasIncomeIntent,
  hasConceptualNoteIntent,
} from './parser-rules.ts';

const TYPE_PATTERNS: Record<EntryType, RegExp[]> = {
  payment: [
    /\b(pagar|pago|abonar|cobrar|factura|cuenta|internet|luz|agua|gas|arriendo|hipoteca|tarjeta|prestamo|préstamo|ingreso|me pagaron|pagaron|venta|deposito|depósito)\b/i,
  ],
  pet: [
    /\b(mascota|perro|gato|veterinario|vet|vacuna|comida\s+(para|del?)|correa|areno|alimento\s+(para|del?))\b/i,
    /\b(thor|luna|max|michis|firulais|pelud)\b/i,
  ],
  health: [
    /\b(remedio|medicamento|medicina|pastilla|jarabe|dosis|tomar\s+(remedio|medicina|pastilla)|vitamina|insulina|presion|presión|temperatura|malestar|dolor|terapia|kine|kinesi[oó]logo|kinesiologa|cl[ií]nica|clinica|hospital)\b/i,
  ],
  appointment: [
    /\b(cita|doctor|doctora|médico|medico|consulta|dentista|oftalmólogo|oftalmologo|dermatólogo|dermatologo|examen|laboratorio|cirugia|cirugía|terapia|kine|kinesi[oó]logo|kinesiologa|control\s+m[eé]dico|cita\s+m[eé]dica)\b/i,
  ],
  reminder: [
    /\b(recordar|recordatorio|acordarse|no\s+olvidar|alerta|avisar)\b/i,
  ],
  task: [
    /\b(comprar|llevar|sacar|hacer|limpiar|lavar|cocinar|preparar|arreglar|revisar|cambiar|ir\s+a|pasar\s+por|buscar|entregar|devolver|agendar|realizar|imprimir|contactar|avisar|enviar|recoger)\b/i,
  ],
  note: [],
  shopping_list: [],
};

export interface ClassificationResult {
  type: EntryType;
  confidence: number;
  reasons: string[];
}

/**
 * Classify text with confidence score.
 * confidence < 0.75 → caller should default to 'note'.
 * source='notes' raises the override threshold to 0.85.
 */
export function classifyWithConfidence(tokens: ExtractedTokens): ClassificationResult {
  const text = tokens.rawText;
  const lower = text.toLowerCase();
  const hasExplicitStoreShoppingContext =
    /\b(compras?|supermercado|super|minimarket|farmacia|ferreter[ií]a|despensa|feria|mercado)\b/i.test(text);

  // Guard: long-form / structured text always → note
  if (isLongFormNote(text)) {
    return { type: 'note', confidence: 0.97, reasons: ['long-form-text'] };
  }

  // Payment — requires both a keyword AND explicit financial intent
  if (tokens.amount !== null && hasIncomeIntent(text)) {
    return { type: 'payment', confidence: 0.9, reasons: ['income-intent'] };
  }

  // Payment — requires both a keyword AND explicit financial intent
  if (TYPE_PATTERNS.payment.some((p) => p.test(lower)) && hasPaymentIntent(text)) {
    return { type: 'payment', confidence: 0.87, reasons: ['payment-intent'] };
  }

  // Pet — concrete care action required, keyword alone is not sufficient
  if (hasPetAction(text)) {
    return { type: 'pet', confidence: 0.87, reasons: ['pet-action'] };
  }

  // Purchase / expense movement — amount + explicit buy wording, but not a list
  if (tokens.amount !== null && hasExpensePurchaseIntent(text) && !tokens.isListLike) {
    return { type: 'payment', confidence: 0.84, reasons: ['purchase-expense-amount'] };
  }

  // Short expense shorthand like "tabaco 15000"
  if (tokens.amount !== null && hasPassiveExpenseIntent(text) && !tokens.isListLike) {
    return { type: 'payment', confidence: 0.8, reasons: ['passive-expense-amount'] };
  }

  // Shopping / pet list — only when there is actual shopping intent
  if (tokens.isListLike) {
    if (hasShoppingIntent(text)) {
      if (hasExplicitStoreShoppingContext) {
        return { type: 'shopping_list', confidence: 0.89, reasons: ['shopping-store-context', 'list-like'] };
      }
      const listType = resolveListEntryType(tokens.detectedTags);
      // Mascotas tag alone is not enough; require a concrete pet action in the items
      if (listType === 'pet' && !hasPetAction(text)) {
        return { type: 'shopping_list', confidence: 0.80, reasons: ['list-mascotas-no-action'] };
      }
      return { type: listType, confidence: 0.87, reasons: ['shopping-intent', 'list-like'] };
    }
    // List-like structure without shopping intent → not a shopping list
    return { type: 'note', confidence: 0.78, reasons: ['list-no-shopping-intent'] };
  }

  // Pet medications or care tied to a known pet name should stay in pets, not health.
  if (TYPE_PATTERNS.pet.some((p) => p.test(lower)) && TYPE_PATTERNS.health.some((p) => p.test(lower))) {
    return { type: 'pet', confidence: 0.86, reasons: ['pet-health-combo'] };
  }

  // Health
  if (hasHealthIntent(text)) {
    if (TYPE_PATTERNS.appointment.some((p) => p.test(lower))) {
      return { type: 'appointment', confidence: 0.84, reasons: ['appointment-keywords'] };
    }
    return { type: 'health', confidence: 0.82, reasons: ['health-keywords'] };
  }

  // Appointment
  if (TYPE_PATTERNS.appointment.some((p) => p.test(lower))) {
    return { type: 'appointment', confidence: 0.82, reasons: ['appointment-keywords'] };
  }

  // Reminder
  if (TYPE_PATTERNS.reminder.some((p) => p.test(lower))) {
    return { type: 'reminder', confidence: 0.77, reasons: ['reminder-keywords'] };
  }

  if (hasConceptualNoteIntent(text)) {
    return { type: 'note', confidence: 0.88, reasons: ['conceptual-note-intent'] };
  }

  // Task
  if (TYPE_PATTERNS.task.some((p) => p.test(lower))) {
    return { type: 'task', confidence: 0.75, reasons: ['task-keywords'] };
  }

  return { type: 'note', confidence: 0.92, reasons: ['no-specific-type'] };
}

export function detectType(tokens: ExtractedTokens, source?: string): EntryType {
  const { type, confidence } = classifyWithConfidence(tokens);
  // From /notes, require higher confidence to override to a non-note type
  const threshold = source === 'notes' ? 0.85 : 0.75;
  return confidence >= threshold ? type : 'note';
}

function buildTitle(tokens: ExtractedTokens, type: EntryType, calendarMetadata?: CalendarEntryMetadata | null): string {
  const calendarLabel = calendarMetadata?.calendar?.events[0]?.label?.trim();
  if (calendarLabel) {
    return calendarLabel;
  }

  if (tokens.isListLike) {
    if (type === 'health') return 'Compra de farmacia';
    if (tokens.detectedTags.includes('mascotas')) return 'Lista para mascotas';
    if (tokens.detectedTags.includes('farmacia')) return 'Lista de farmacia';
    if (tokens.detectedTags.includes('aseo hogar') || tokens.detectedTags.includes('casa')) {
      return 'Lista para la casa';
    }
    return 'Lista de compras';
  }

  const base = (tokens.cleanedText.trim() || tokens.rawText.trim())
    .replace(/\b(?:para|por|en|de|con|a|al|el|la)\s*$/i, '')
    .trim();
  if (!base) return tokens.rawText.trim();

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // For long-form notes, extract a concise title from the first line
  if (type === 'note' && base.length > 80) {
    const firstLine = base.split('\n')[0]?.trim() ?? '';
    if (firstLine.length >= 5) {
      return cap(firstLine.slice(0, 75).trimEnd()) + (firstLine.length > 75 ? '…' : '');
    }
    return cap(base.slice(0, 60).trimEnd()) + '…';
  }

  if (type === 'shopping_list') {
    return cap(base);
  }
  if (
    type === 'payment'
    && !hasPaymentIntent(base)
    && !hasIncomeIntent(base)
    && !hasExpensePurchaseIntent(base)
    && !hasPassiveExpenseIntent(base)
  ) {
    return `Pagar ${base}`;
  }
  return cap(base);
}

function buildTags(rawText: string, type: EntryType): string[] {
  const tags: string[] = [type];
  const lower = rawText.toLowerCase();

  if (type === 'payment') {
    tags.push(hasIncomeIntent(rawText) ? 'income' : 'expense');
  }

  if (/\b(urgente|urgencia|importante|prioridad|ya|inmediato)\b/i.test(lower)) {
    tags.push('urgente');
  }
  if (/\b(semanal|cada\s+semana|todos\s+los\s+días|diario|diaria)\b/i.test(lower)) {
    tags.push('recurrente');
  }

  return tags;
}

function buildPaymentMetadata(rawText: string, type: EntryType): Record<string, unknown> | undefined {
  if (type !== 'payment') return undefined;
  return {
    direction: hasIncomeIntent(rawText) ? 'income' : 'expense',
  };
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

export function normalizeEntry(tokens: ExtractedTokens, source?: string): ParsedEntry {
  const classification = classifyWithConfidence(tokens);
  const threshold = source === 'notes' ? 0.85 : 0.75;
  const type = classification.confidence >= threshold ? classification.type : 'note';

  const calendarResult = type !== 'payment'
    ? parseCalendarEventInput(tokens.rawText, tokens.baseDate)
    : null;
  const calendarMetadata = calendarResult?.metadata ?? null;
  const shouldPreferCalendarTitle =
    calendarResult?.matched
    && calendarResult.title
    && calendarResult.title !== 'Evento'
    && (type === 'note' || type === 'task' || type === 'reminder');
  const title = shouldPreferCalendarTitle
    ? calendarResult.title!
    : buildTitle(tokens, type, calendarMetadata);
  const date = tokens.dateSource === 'explicit'
    ? tokens.date ?? undefined
    : calendarResult?.matched
      ? calendarResult.date ?? undefined
      : tokens.date ?? undefined;
  const tags = Array.from(new Set([...buildTags(tokens.rawText, type), ...tokens.detectedTags]));
  // Only attach shopping metadata when the resolved type is actually a list type.
  // Attaching it to 'note' or 'task' entries causes them to leak into /purchases.
  const isListType = type === 'shopping_list' || type === 'pet' || type === 'health';
  const shoppingMetadata = isListType ? buildShoppingMetadata(tokens) : undefined;

  const shoppingTotal =
    shoppingMetadata && shoppingMetadata.listKind === 'shopping' && shoppingMetadata.progress.totalEstimated > 0
      ? shoppingMetadata.progress.totalEstimated
      : undefined;

  const paymentMetadata = buildPaymentMetadata(tokens.rawText, type);

  const metadata = shoppingMetadata && calendarMetadata
    ? { ...shoppingMetadata, ...calendarMetadata }
    : shoppingMetadata ?? calendarMetadata ?? paymentMetadata ?? undefined;

  if (paymentMetadata && metadata && metadata !== paymentMetadata) {
    Object.assign(metadata, paymentMetadata);
  }

  return {
    text: tokens.rawText,
    type,
    title,
    date,
    time: calendarResult?.matched ? calendarResult.time ?? undefined : tokens.time ?? undefined,
    tags,
    amount: type === 'payment' ? tokens.amount ?? undefined : undefined,
    checklistItems: tokens.checklistItems.length ? tokens.checklistItems : undefined,
    listItems: tokens.listItems.length ? tokens.listItems : undefined,
    listGroups: tokens.listGroups.length ? tokens.listGroups : undefined,
    detectedTags: tokens.detectedTags.length ? tokens.detectedTags : undefined,
    metadata,
    confidence: classification.confidence,
    reasons: classification.reasons,
  };
}
