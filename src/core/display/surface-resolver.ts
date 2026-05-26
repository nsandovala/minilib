/**
 * Surface resolver — determines which UI surfaces should show an entry.
 *
 * Category pages must NOT trust entry.type blindly: legacy entries may have
 * wrong types from older parser versions. This module resolves the correct
 * visual surface from the full entry shape (metadata, text length, intent).
 */
import type { TimelineEntry } from '@/types';
import { hasProjectIntent } from '../agents/parser-rules.ts';

export type Surface =
  | 'home'
  | 'notes'
  | 'calendar'
  | 'payments'
  | 'purchases'
  | 'pets'
  | 'health'
  | 'todos';

export interface ResolvedSurface {
  primary: Surface;
  secondary: Surface[];
  /** true when raw entry.type does not match the resolved primary surface */
  isLegacyOverride: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function normalize(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function entryHaystack(entry: TimelineEntry): string {
  return normalize(`${entry.title} ${entry.text}`);
}

export function hasCalendarMetadata(entry: TimelineEntry): boolean {
  const m = entry.metadata as { calendar?: { events?: unknown[] } } | null | undefined;
  return !!m?.calendar && Array.isArray(m.calendar.events);
}

// ─── Long-form note guard ─────────────────────────────────────────────────────
//
// Research/document/UX-spec notes must not pollute category pages even when
// they mention category keywords (e.g. "módulo mascotas", "flujo de compras").
// This is the primary defense against legacy mis-classification pollution.

export function isLongFormNote(entry: TimelineEntry): boolean {
  const combined = `${entry.title} ${entry.text}`;

  if (combined.length > 500) return true;
  if (/\n\n/.test(entry.text) && entry.text.length > 200) return true;
  if (/^\s*\d+\.\s+/m.test(entry.text)) return true;   // numbered sections
  if (/^#{1,3}\s+/m.test(entry.text)) return true;     // markdown headers

  const h = normalize(combined);
  const docKeywords = [
    'vision estrategica',
    'arquitectura del',
    'roadmap',
    'conclusion',
    'investigacion sobre',
    'analisis de',
    'modulo mascotas',
    'modulo compras',
    'categoria mascotas',
    'categoria compras',
    'sprint',
    'backlog',
    'alcance del proyecto',
    'objetivos del proyecto',
    'propuesta de',
    'flujo de trabajo',
    'caso de uso',
  ];
  return docKeywords.some((kw) => h.includes(kw));
}

// ─── Surface intent detectors ─────────────────────────────────────────────────

function hasActionablePetIntent(entry: TimelineEntry): boolean {
  if (hasCalendarMetadata(entry)) return false;
  if (isLongFormNote(entry)) return false;
  // Shopping lists stay in purchases even if their content mentions pet-care words
  if (entry.type === 'shopping_list') return false;
  const m = entry.metadata as { listKind?: string } | null | undefined;
  if (m?.listKind === 'shopping') return false;
  const h = entryHaystack(entry);
  return /\b(veterinario|veterinaria|vacuna|pastilla|desparasitar|bano|banar|corte de pelo|peluqueria|correa|comida para|comida de la|alimento para|arena de|arena del|paseo de|control del perro|control del gato)\b/.test(h);
}

function hasActionablePurchaseIntent(entry: TimelineEntry): boolean {
  if (hasCalendarMetadata(entry)) return false;
  if (entry.type === 'shopping_list') return true;
  const m = entry.metadata as { listKind?: string } | null | undefined;
  if (m?.listKind === 'shopping') {
    // Block project/idea entries that got stale shopping metadata from an old parser version
    return !hasProjectIntent(`${entry.title} ${entry.text}`);
  }
  if (isLongFormNote(entry)) return false;
  const h = entryHaystack(entry);
  return /\b(supermercado|feria|mercado|despensa|lista de compras|lista para comprar|comprar leche|comprar pan|comprar huevo|comprar fruta|comprar verdura)\b/.test(h);
}

function hasFinanceIntent(entry: TimelineEntry): boolean {
  return entry.type === 'payment'
    && typeof entry.amount === 'number'
    && !Number.isNaN(entry.amount);
}

function hasActionableHealthIntent(entry: TimelineEntry): boolean {
  if (entry.type === 'health' || entry.type === 'appointment') {
    return !isLongFormNote(entry);
  }
  if (isLongFormNote(entry)) return false;
  const h = entryHaystack(entry);
  return /\b(doctor|doctora|medico|medica|consulta medica|cita medica|dentista|odontologo|examen medico|ecografia|analisis clinico|remedio|pastilla|comprimido|inyeccion|sintoma|fiebre|dolor de cabeza|control medico)\b/.test(h);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getPrimarySurface(entry: TimelineEntry): Surface {
  // Rule A: calendar metadata always wins
  if (hasCalendarMetadata(entry)) return 'calendar';

  // Rule B: long-form notes go to notes regardless of type
  if (isLongFormNote(entry)) return 'notes';

  switch (entry.type) {
    case 'payment':
      return hasFinanceIntent(entry) ? 'payments' : 'notes';
    case 'shopping_list':
      return 'purchases';
    case 'health':
    case 'appointment':
      return 'health';
    case 'pet':
      // Short type=pet entries are trusted as valid pet records.
      // Long-form docs that happen to have type=pet are legacy mis-classifications.
      return isLongFormNote(entry) ? 'notes' : 'pets';
    case 'task':
      return 'todos';
    case 'note':
    case 'reminder':
    default:
      return 'notes';
  }
}

export function getSecondarySurfaces(entry: TimelineEntry): Surface[] {
  const primary = getPrimarySurface(entry);
  const secondary: Surface[] = [];

  if (primary === 'calendar') {
    secondary.push('notes');
    if (entry.date) secondary.push('home');
    return secondary;
  }

  if (primary !== 'home') secondary.push('home');
  return secondary;
}

export function resolveSurfaceForEntry(entry: TimelineEntry): ResolvedSurface {
  const primary = getPrimarySurface(entry);
  const secondary = getSecondarySurfaces(entry);

  const typeToSurface: Partial<Record<string, Surface>> = {
    payment:      'payments',
    shopping_list: 'purchases',
    health:       'health',
    appointment:  'health',
    pet:          'pets',
    task:         'todos',
    note:         'notes',
    reminder:     'notes',
  };
  const expectedFromType = typeToSurface[entry.type];
  const isLegacyOverride = !!expectedFromType && expectedFromType !== primary;

  return { primary, secondary, isLegacyOverride };
}

/**
 * Primary guard for category pages.
 * Use this instead of raw `entry.type` comparisons so legacy mis-typed entries
 * are handled at the display layer without mutating data.
 */
export function shouldShowOnSurface(entry: TimelineEntry, surface: Surface): boolean {
  // Calendar metadata takes priority for all surfaces
  if (surface === 'calendar') return hasCalendarMetadata(entry);

  // Rule A: calendar entries only go to calendar + notes + home (if dated)
  if (hasCalendarMetadata(entry)) {
    return surface === 'notes' || surface === 'home';
  }

  switch (surface) {
    case 'pets':
      // Rule C: requires actionable pet intent, not conceptual/research mentions
      // Shopping lists never appear in pets even if text contains pet-care words
      if (entry.type === 'shopping_list') return false;
      return !isLongFormNote(entry) && (entry.type === 'pet' || hasActionablePetIntent(entry));

    case 'purchases':
      // Rule D: requires real shopping/list intent, not UX/product docs
      return hasActionablePurchaseIntent(entry) || entry.type === 'shopping_list';

    case 'payments':
      // Rule E: requires valid amount + payment type
      return hasFinanceIntent(entry);

    case 'health':
      // Rule F: requires medical intent, not generic health mentions in docs
      return hasActionableHealthIntent(entry);

    case 'notes':
      // Notes surface: notes, reminders, calendar entries, and long-form docs
      // (including legacy mis-typed pet/health/payment entries that are really notes)
      return (
        entry.type === 'note' ||
        entry.type === 'reminder' ||
        isLongFormNote(entry)
      );

    case 'todos':
      return entry.type === 'task';

    case 'home':
      return true;

    default:
      return false;
  }
}
