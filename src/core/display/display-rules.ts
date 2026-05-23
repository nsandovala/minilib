import type { TimelineEntry } from '@/types';

export interface DisplayRuleContext {
  expanded?: boolean;
  currentSurface?: string | null;
  primarySurface?: string | null;
  calmExplanation?: string | null;
  correctionHint?: string | null;
}

export interface CalendarDisplayCopy {
  headline: string;
  pendingLabel: string | null;
  prompt: string | null;
}

interface DisplayCalendarMetadata {
  kind: 'multi_event' | 'single_event';
  expectedCount?: number;
  events: unknown[];
}

function normalizeEntryText(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function getCalendarMetadata(entry: TimelineEntry): DisplayCalendarMetadata | null {
  const candidate = entry.metadata as { calendar?: { kind?: string; expectedCount?: number; events?: unknown[] } } | null | undefined;
  if (!candidate?.calendar || !Array.isArray(candidate.calendar.events)) return null;
  if (candidate.calendar.kind !== 'multi_event' && candidate.calendar.kind !== 'single_event') return null;
  return {
    kind: candidate.calendar.kind,
    expectedCount: candidate.calendar.expectedCount,
    events: candidate.calendar.events,
  };
}

function getEntryDisplayTitle(entry: TimelineEntry): string {
  const normalizedTitle = normalizeEntryText(entry.title);
  const normalizedText = normalizeEntryText(entry.text);
  return normalizedTitle || normalizedText || 'Sin contenido';
}

function getMetadataRecord(entry: TimelineEntry): Record<string, unknown> {
  return entry.metadata && typeof entry.metadata === 'object'
    ? entry.metadata as Record<string, unknown>
    : {};
}

function getMetadataNumber(entry: TimelineEntry, key: string): number | null {
  const value = getMetadataRecord(entry)[key];
  return typeof value === 'number' ? value : null;
}

function getMetadataBoolean(entry: TimelineEntry, key: string): boolean {
  return getMetadataRecord(entry)[key] === true;
}

function isGenericExplanation(copy?: string | null): boolean {
  if (!copy) return true;
  const normalized = normalizeEntryText(copy).toLowerCase();
  return [
    'guardé esto como nota para que mantengas tu flujo de trabajo en orden.',
    'tarea pendiente detectada. la mantengo visible hasta que la completes.',
    'pago pendiente. lo puse arriba por riesgo de olvido.',
    'pendiente de mascota notificado.',
    'lista detectada para ordenar sus compras.',
  ].includes(normalized);
}

function isResearchOrLongDoc(entry: TimelineEntry): boolean {
  // Mirrors the core long-form guard in surface-resolver without importing it,
  // to avoid cross-module value imports that break Node --experimental-strip-types.
  const combined = `${entry.title} ${entry.text}`;
  if (combined.length > 500) return true;
  if (/\n\n/.test(entry.text) && entry.text.length > 200) return true;
  if (/^\s*\d+\.\s+/m.test(entry.text)) return true;
  if (/^#{1,3}\s+/m.test(entry.text)) return true;
  return false;
}

function isLikelyTaskOrPayment(entry: TimelineEntry): boolean {
  // Research/doc notes may mention task/payment keywords; they are not mis-classifications
  if (isResearchOrLongDoc(entry)) return false;
  const haystack = normalizeEntryText(`${entry.title} ${entry.text}`).toLowerCase();
  return /\b(pagar|pago|cuenta|factura|vencimiento|hacer|llamar|enviar|revisar|comprar|recordar|pendiente)\b/.test(haystack);
}

function isAmbiguousEntry(entry: TimelineEntry): boolean {
  if (entry.type === 'note' && isLikelyTaskOrPayment(entry)) return true;

  const title = getEntryDisplayTitle(entry).toLowerCase();
  const genericTitles = new Set(['nota', 'recordatorio', 'sin contenido', 'evento']);
  if (genericTitles.has(title) && (!!entry.date || !!entry.amount)) return true;

  return false;
}

function hasLowConfidence(entry: TimelineEntry): boolean {
  const entryConfidence = getMetadataNumber(entry, 'confidence');
  const parserConfidence = getMetadataNumber(entry, 'parserConfidence');
  const confidence = entryConfidence ?? parserConfidence;
  return confidence !== null && confidence < 0.8;
}

function wasAutoCorrected(entry: TimelineEntry): boolean {
  const metadata = getMetadataRecord(entry);
  return (
    getMetadataBoolean(entry, 'autoCorrected') ||
    typeof metadata.correctedFrom === 'string' ||
    typeof metadata.reclassifiedFrom === 'string'
  );
}

function isOutsidePrimarySurface(context: DisplayRuleContext): boolean {
  if (!context.currentSurface || !context.primarySurface) return false;
  return context.currentSurface !== context.primarySurface;
}

export function shouldShowCalmExplanation(entry: TimelineEntry, context: DisplayRuleContext = {}): boolean {
  if (!context.expanded || !context.calmExplanation) return false;
  if (isCalendarEntryWithStructuredDetails(entry)) return false;

  const lowConfidence = hasLowConfidence(entry);
  const autoCorrected = wasAutoCorrected(entry);
  const outsidePrimary = isOutsidePrimarySurface(context);
  const specific = !isGenericExplanation(context.calmExplanation);

  // Generic explanations ("Guardé esto como nota…", etc.) only show when
  // the classifier explicitly flagged low confidence or corrected the type.
  // Ambiguity alone is not enough — correction hints handle that case instead.
  if (!specific) {
    return lowConfidence || autoCorrected;
  }

  // Specific (non-generic) explanations show for any contextual reason.
  return lowConfidence || autoCorrected || outsidePrimary || isAmbiguousEntry(entry);
}

function isStronglyLikelyPayment(entry: TimelineEntry): boolean {
  // Explicit financial keywords only — generic task words (hacer, comprar, recordar)
  // are not strong enough signals to surface a reclassification hint.
  if (isResearchOrLongDoc(entry)) return false;
  const haystack = normalizeEntryText(`${entry.title} ${entry.text}`).toLowerCase();
  return /\b(pagar|pago|factura|vencimiento|deuda|cuota|cargo|cobro)\b/.test(haystack);
}

export function shouldShowCorrectionHint(entry: TimelineEntry, context: DisplayRuleContext = {}): boolean {
  if (!context.expanded || !context.correctionHint) return false;

  return (
    hasLowConfidence(entry) ||
    wasAutoCorrected(entry) ||
    isOutsidePrimarySurface(context) ||
    isStronglyLikelyPayment(entry)
  );
}

export function shouldShowOriginalText(entry: TimelineEntry, context: DisplayRuleContext = {}): boolean {
  if (!context.expanded) return false;

  const original = normalizeEntryText(entry.text);
  const displayTitle = normalizeEntryText(getEntryDisplayTitle(entry));
  if (!original || original.toLowerCase() === displayTitle.toLowerCase()) return false;

  const calendar = getCalendarMetadata(entry);
  if (calendar) {
    if (calendar.events.length > 0) return false;
    if (calendar.expectedCount) return false;
  }

  return true;
}

function isCalendarEntryWithStructuredDetails(entry: TimelineEntry): boolean {
  const calendar = getCalendarMetadata(entry);
  return !!calendar && calendar.events.length > 0;
}

export function getCalendarDisplayCopy(entry: TimelineEntry): CalendarDisplayCopy {
  const calendar = getCalendarMetadata(entry);
  if (!calendar) {
    return {
      headline: '',
      pendingLabel: null,
      prompt: null,
    };
  }

  if (calendar.kind === 'single_event') {
    return {
      headline: 'Evento agendado',
      pendingLabel: null,
      prompt: null,
    };
  }

  if (calendar.events.length > 0) {
    return {
      headline: 'Agenda del día',
      pendingLabel: null,
      prompt: null,
    };
  }

  return {
    headline: 'Día con eventos por confirmar',
    pendingLabel: calendar.expectedCount ? `${calendar.expectedCount} eventos por detallar` : null,
    prompt: 'Agrega horarios para ordenar este día.',
  };
}
