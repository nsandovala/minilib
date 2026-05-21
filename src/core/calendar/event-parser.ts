import type { CalendarEntryMetadata, CalendarEventItem } from '@/types';
import { formatLocalDateKey } from '../../lib/date.ts';

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

const COUNT_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

const ORDINAL_WORDS: Record<string, number> = {
  primer: 1,
  primero: 1,
  primera: 1,
  segundo: 2,
  segunda: 2,
  tercer: 3,
  tercero: 3,
  tercera: 3,
  cuarto: 4,
  cuarta: 4,
  quinto: 5,
  quinta: 5,
};

const ORDERED_EVENT_PATTERN =
  /(?:\b(?:el|la)\s+)?\b(primer|primero|primera|segundo|segunda|tercer|tercero|tercera|cuarto|cuarta|quinto|quinta|\d+)\b(?:\s+evento)?(?:\s+es)?\s*(?:a\s+las?|a\s+la|al|desde\s+las?|desde)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)([\s\S]*?)(?=(?:\b(?:el|la)\s+)?\b(?:primer|primero|primera|segundo|segunda|tercer|tercero|tercera|cuarto|cuarta|quinto|quinta|\d+)\b(?:\s+evento)?\b|$)/gi;

const PREFIXED_TIME_PATTERN = /(?:a\s+las?|a\s+la|al|desde\s+las?|desde)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
const BARE_TIME_PATTERN = /\b(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/gi;

export interface CalendarParseResult {
  matched: boolean;
  title: string | null;
  date: string | null;
  time: string | null;
  metadata: CalendarEntryMetadata | null;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCountTitle(count: number): string {
  return `${count} evento${count === 1 ? '' : 's'}`;
}

function toMatchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getNextDayOfWeek(dayIndex: number, baseDate: Date): string {
  const currentDay = baseDate.getDay();
  let diff = dayIndex - currentDay;
  if (diff <= 0) diff += 7;
  const target = new Date(baseDate);
  target.setDate(baseDate.getDate() + diff);
  return formatLocalDateKey(target);
}

function resolveDate(text: string, baseDate: Date): string | null {
  const normalized = toMatchText(text);

  if (/\bhoy\b/.test(normalized)) return formatLocalDateKey(baseDate);
  if (/\bmanana\b/.test(normalized)) {
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(baseDate.getDate() + 1);
    return formatLocalDateKey(tomorrow);
  }

  const dayNameMatch = normalized.match(
    /\b(?:el\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/,
  );
  if (dayNameMatch) {
    const dayIndex = DAY_MAP[dayNameMatch[1]];
    if (dayIndex !== undefined) return getNextDayOfWeek(dayIndex, baseDate);
  }

  const longDateMatch = normalized.match(
    /\b(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|sept|octubre|nov|noviembre|dic|diciembre)\b/,
  );
  if (longDateMatch) {
    const day = Number.parseInt(longDateMatch[1], 10);
    const month = MONTH_MAP[longDateMatch[2]];
    if (month === undefined) return null;
    const candidate = new Date(baseDate.getFullYear(), month, day, 12);
    if (candidate < baseDate) candidate.setFullYear(candidate.getFullYear() + 1);
    return formatLocalDateKey(candidate);
  }

  const slashDateMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashDateMatch) {
    const day = Number.parseInt(slashDateMatch[1], 10);
    const month = Number.parseInt(slashDateMatch[2], 10) - 1;
    const year = slashDateMatch[3]
      ? Number.parseInt(slashDateMatch[3].length === 2 ? `20${slashDateMatch[3]}` : slashDateMatch[3], 10)
      : baseDate.getFullYear();
    const candidate = new Date(year, month, day, 12);
    if (!slashDateMatch[3] && candidate < baseDate) candidate.setFullYear(candidate.getFullYear() + 1);
    return formatLocalDateKey(candidate);
  }

  const isoMatch = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return isoMatch?.[1] ?? null;
}

function resolveCount(text: string): number | null {
  const normalized = toMatchText(text);
  const match = normalized.match(/\b(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+eventos?\b/);
  if (!match) return null;

  const raw = match[1];
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  return COUNT_WORDS[raw] ?? null;
}

function normalizeTime(raw: string): string | null {
  const match = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] ?? '0', 10);
  const meridiem = match[3]?.toLowerCase();

  if (hours > 23 || minutes > 59) return null;

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function cleanEventLabel(segment: string): string {
  return capitalize(
    segment
      .replace(/^[\s,.;:-]+/, '')
      .replace(/\b(?:y|luego|despues|después)\b\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function extractOrderedEvents(text: string): CalendarEventItem[] {
  const events: CalendarEventItem[] = [];
  const pattern = new RegExp(ORDERED_EVENT_PATTERN.source, ORDERED_EVENT_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const orderRaw = match[1]?.toLowerCase() ?? '';
    const order = /^\d+$/.test(orderRaw)
      ? Number.parseInt(orderRaw, 10)
      : ORDINAL_WORDS[orderRaw];
    const time = normalizeTime(match[2] ?? '');

    if (!order || !time) continue;

    events.push({
      order,
      time,
      label: cleanEventLabel(match[3] ?? ''),
    });
  }

  return events;
}

function extractTimeMatches(text: string): Array<{ start: number; end: number; time: string }> {
  const matches: Array<{ start: number; end: number; time: string }> = [];
  const seen = new Set<string>();

  const pushMatch = (match: RegExpMatchArray) => {
    const value = normalizeTime(match[1] ?? '');
    const index = match.index ?? -1;
    if (!value || index < 0) return;

    const end = index + match[0].length;
    const key = `${index}:${end}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    matches.push({ start: index, end, time: value });
  };

  const prefixedPattern = new RegExp(PREFIXED_TIME_PATTERN.source, PREFIXED_TIME_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = prefixedPattern.exec(text)) !== null) pushMatch(match);

  const barePattern = new RegExp(BARE_TIME_PATTERN.source, BARE_TIME_PATTERN.flags);
  while ((match = barePattern.exec(text)) !== null) {
    const bareMatch = match;
    const withinKnownRange = matches.some((known) => (bareMatch.index ?? -1) >= known.start && (bareMatch.index ?? -1) < known.end);
    if (!withinKnownRange) pushMatch(bareMatch);
  }

  return matches.sort((a, b) => a.start - b.start);
}

function extractSingleOrImplicitEvents(text: string): CalendarEventItem[] {
  const matches = extractTimeMatches(text);
  return matches.map((match, index) => {
    const nextStart = matches[index + 1]?.start ?? text.length;
    const label = cleanEventLabel(text.slice(match.end, nextStart));
    return {
      order: index + 1,
      time: match.time,
      label,
    };
  });
}

export function sortCalendarEvents(events: CalendarEventItem[]): CalendarEventItem[] {
  return [...events].sort((a, b) => {
    const timeCompare = a.time.localeCompare(b.time);
    if (timeCompare !== 0) return timeCompare;
    return a.order - b.order;
  });
}

export function getCalendarMetadata(
  metadata: CalendarEntryMetadata | Record<string, unknown> | null | undefined,
): CalendarEntryMetadata['calendar'] | null {
  const candidate = metadata as CalendarEntryMetadata | null | undefined;
  if (!candidate || typeof candidate !== 'object' || !('calendar' in candidate)) return null;

  const calendar = candidate.calendar;
  if (!calendar || typeof calendar !== 'object' || !Array.isArray(calendar.events)) return null;
  if (calendar.kind !== 'multi_event' && calendar.kind !== 'single_event') return null;

  return calendar;
}

export function parseCalendarEventInput(rawText: string, baseDate: Date = new Date()): CalendarParseResult {
  const date = resolveDate(rawText, baseDate);
  const expectedCount = resolveCount(rawText);
  const orderedEvents = extractOrderedEvents(rawText);
  const implicitEvents = orderedEvents.length > 0 ? orderedEvents : extractSingleOrImplicitEvents(rawText);
  const normalizedText = toMatchText(rawText);
  const hasCalendarSignal = Boolean(date && (expectedCount || implicitEvents.length > 0 || /\beventos?\b/.test(normalizedText)));

  if (!hasCalendarSignal) {
    return {
      matched: false,
      title: null,
      date: null,
      time: null,
      metadata: null,
    };
  }

  const kind = expectedCount && expectedCount > 1
    ? 'multi_event'
    : implicitEvents.length > 1
      ? 'multi_event'
      : 'single_event';

  const events = implicitEvents.filter((event, index, all) =>
    all.findIndex((candidate) => candidate.order === event.order && candidate.time === event.time) === index,
  );
  const sortedEvents = sortCalendarEvents(events);
  const earliestTime = sortedEvents[0]?.time ?? null;
  const totalCount = expectedCount ?? (kind === 'multi_event' ? Math.max(events.length, 2) : 1);
  const shouldKeepExpectedCount = kind === 'multi_event' && expectedCount !== null && events.length < expectedCount;

  const title = kind === 'multi_event'
    ? formatCountTitle(totalCount)
    : events[0]?.label || 'Evento';

  return {
    matched: true,
    title,
    date,
    time: earliestTime,
    metadata: {
      calendar: {
        kind,
        expectedCount: shouldKeepExpectedCount ? expectedCount ?? undefined : undefined,
        events,
      },
    },
  };
}
