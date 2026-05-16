import type { EntryType, ParsedEntry, ShoppingMetadata } from '@/types';
import type { ExtractedTokens } from './parser-agent';
import {
  resolveListEntryType,
  isLongFormNote,
  hasPetAction,
  hasShoppingIntent,
  hasPaymentIntent,
} from './parser-rules';

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

  // Guard: long-form / structured text always → note
  if (isLongFormNote(text)) {
    return { type: 'note', confidence: 0.97, reasons: ['long-form-text'] };
  }

  // Shopping / pet list — only when there is actual shopping intent
  if (tokens.isListLike) {
    if (hasShoppingIntent(text)) {
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

  // Payment — requires both a keyword AND explicit financial intent
  if (TYPE_PATTERNS.payment.some((p) => p.test(lower)) && hasPaymentIntent(text)) {
    return { type: 'payment', confidence: 0.87, reasons: ['payment-intent'] };
  }

  // Pet — concrete care action required, keyword alone is not sufficient
  if (hasPetAction(text)) {
    return { type: 'pet', confidence: 0.87, reasons: ['pet-action'] };
  }

  // Health
  if (TYPE_PATTERNS.health.some((p) => p.test(lower))) {
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

  const base = tokens.cleanedText.trim() || tokens.rawText.trim();
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

export function normalizeEntry(tokens: ExtractedTokens, source?: string): ParsedEntry {
  const classification = classifyWithConfidence(tokens);
  const threshold = source === 'notes' ? 0.85 : 0.75;
  const type = classification.confidence >= threshold ? classification.type : 'note';

  const title = buildTitle(tokens, type);
  const tags = Array.from(new Set([...buildTags(tokens.rawText, type), ...tokens.detectedTags]));
  const metadata = buildShoppingMetadata(tokens);

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
    confidence: classification.confidence,
    reasons: classification.reasons,
  };
}
