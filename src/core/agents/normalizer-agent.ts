import type { EntryType, ParsedEntry } from '@/types';
import type { ExtractedTokens } from './parser-agent';

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
};

export function detectType(tokens: ExtractedTokens): EntryType {
  const lower = tokens.rawText.toLowerCase();

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
  // Use cleanedText: date/time/amount are already stripped, so the verb stays intact.
  // e.g. "comprar cilantro mañana" → cleanedText = "comprar cilantro" → "Comprar cilantro"
  const base = tokens.cleanedText.trim() || tokens.rawText.trim();
  if (!base) return tokens.rawText.trim();

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

export function normalizeEntry(tokens: ExtractedTokens): ParsedEntry {
  const type = detectType(tokens);
  const title = buildTitle(tokens, type);
  const tags = buildTags(tokens.rawText, type);

  return {
    text: tokens.rawText,
    type,
    title,
    date: tokens.date ?? undefined,
    time: tokens.time ?? undefined,
    tags,
    amount: tokens.amount ?? undefined,
  };
}
