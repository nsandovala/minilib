export interface ExtractedTokens {
  rawText: string;
  time: string | null;
  date: string | null;
  amount: number | null;
  keywords: string[];
  cleanedText: string;
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
  const match = text.match(
    /(?:a\s+las?|al?|desde)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (!match) return { time: null, cleaned: text };

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
    const raw = lucasMatch[1].replace(/[.,]/g, '');
    return {
      amount: parseInt(raw, 10),
      cleaned: text.replace(lucasMatch[0], '').replace(/\s+/g, ' ').trim(),
    };
  }

  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    return {
      amount: Math.round(parseFloat(kMatch[1]) * 1000),
      cleaned: text.replace(kMatch[0], '').replace(/\s+/g, ' ').trim(),
    };
  }

  const fullNumberMatch = text.match(/(\d{3,}(?:[.,]\d{3})*)/);
  if (fullNumberMatch) {
    const raw = fullNumberMatch[1].replace(/[.,]/g, '');
    const num = parseInt(raw, 10);
    if (num >= 100) {
      return {
        amount: num,
        cleaned: text.replace(fullNumberMatch[0], '').replace(/\s+/g, ' ').trim(),
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

export function parseTokens(rawText: string): ExtractedTokens {
  const { time, cleaned: afterTime } = extractTime(rawText);
  const { date, cleaned: afterDate } = extractDate(afterTime);
  const { amount, cleaned: afterAmount } = extractAmount(afterDate);
  const keywords = extractKeywords(afterAmount);

  return {
    rawText,
    time,
    date,
    amount,
    keywords,
    cleanedText: afterAmount,
  };
}
