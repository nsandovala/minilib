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

function buildTitle(rawText: string, type: EntryType): string {
  const lower = rawText.toLowerCase();

  if (type === 'payment') {
    const match =
      lower.match(
        /pagar\s+(.+?)(?:\s+(?:el|para|en|de)\s+(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|hoy|mañana|manana|\d))/i
      ) || lower.match(/pagar\s+(.+?)(?:\s+(?:a|en|de|para)\s)/i);
    if (match) return `Pagar ${match[1].trim()}`;
    const payMatch = lower.match(/pagar\s+(.+)/i);
    if (payMatch) return `Pagar ${payMatch[1].trim()}`;
  }

  if (type === 'pet') {
    const match = lower.match(
      /(?:comida|comprar|llevar|dar)\s+(.+?)(?:\s+(?:para|al|del|el|mañana|manana|hoy|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|\d))/i
    );
    if (match) return match[1].trim();
  }

  if (type === 'health') {
    const match = lower.match(
      /(?:tomar)\s+(.+?)(?:\s+(?:a|en|de|para|el|la|los|las|hoy|mañana|manana|\d))/i
    );
    if (match) return `Tomar ${match[1].trim()}`;
  }

  if (type === 'appointment') {
    const match = lower.match(
      /(?:cita|consulta|doctor|doctora|médico|medico)\s+(.+?)(?:\s+(?:el|para|en|de|a|la|las|hoy|mañana|manana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|\d))/i
    );
    if (match) return `Cita: ${match[1].trim()}`;
    const citaMatch = lower.match(/cita\s+(.+)/i);
    if (citaMatch) return `Cita: ${citaMatch[1].trim()}`;
  }

  if (type === 'task') {
    const match = lower.match(
      /^(?:comprar|llevar|sacar|hacer|limpiar|lavar|cocinar|preparar|arreglar|revisar|cambiar|ir\s+a|pasar\s+por|buscar|entregar|devolver|agendar)\s+(.+?)(?:\s+(?:el|para|en|de|a|la|las|hoy|mañana|manana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|\d|a\s+las))/i
    );
    if (match) return match[1].trim();
  }

  const words = rawText.split(' ').slice(0, 6).join(' ');
  return words.length > 50 ? words.slice(0, 50) + '...' : words || rawText;
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
  const title = buildTitle(tokens.rawText, type);
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
