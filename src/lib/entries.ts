import type { TimelineEntry } from '@/types';
import { formatLocalDateKey, addDays } from './date';

export type EntryPriority = 'normal' | 'important' | 'urgent';
export type FinancialDirection = 'income' | 'expense';

const LIST_ITEM_TAG_PREFIX = '__list_item__:';
const LIST_GROUP_TAG_PREFIX = '__list_group__:';
const DETECTED_TAG_PREFIX = '__detected_tag__:';
const CHECKLIST_ITEM_TAG_PREFIX = '__checklist_item__:';

const INCOME_PATTERN =
  /\b(ingreso|sueldo|me\s+pagaron|pagaron|venta|transferencia\s+recibida|entró|entro|depósito|deposito)\b/i;

export function getFinancialDirection(entry: TimelineEntry): FinancialDirection {
  const haystack = `${entry.text} ${entry.title}`;
  return INCOME_PATTERN.test(haystack) ? 'income' : 'expense';
}

export function getIncomeCategory(entry: TimelineEntry): string {
  const h = `${entry.text} ${entry.title}`.toLowerCase();
  if (/\bsueldo\b/.test(h))       return 'sueldo';
  if (/\bventa\b/.test(h))        return 'venta';
  if (/\btransferencia\b/.test(h)) return 'transferencia';
  if (/\bpagaron\b/.test(h))      return 'pago recibido';
  if (/\bentró\b|\bentro\b/.test(h)) return 'depósito';
  return 'ingreso';
}

export function getExpenseCategory(entry: TimelineEntry): string {
  const h = `${entry.text} ${entry.title}`.toLowerCase();
  if (/\b(luz|agua|gas|internet|arriendo|hipoteca|tarjeta|cuenta|factura)\b/.test(h)) return 'cuentas fijas';
  if (/\b(remedio|doctor|dentista|consulta|medicina|farmacia)\b/.test(h))             return 'salud';
  if (/\b(mascota|perro|gato|vet|veterinario|comida\s+para)\b/.test(h))              return 'mascota';
  if (/\b(supermercado|feria|mercado|compra)\b/.test(h))                              return 'gasto cotidiano';
  if (/\b(compré|compre|gasté|gaste)\b/.test(h))                                     return 'gasto';
  return 'otros pagos';
}

export function getFinancialCategory(entry: TimelineEntry): string {
  return getFinancialDirection(entry) === 'income'
    ? getIncomeCategory(entry)
    : getExpenseCategory(entry);
}

export function encodeEntryTagsForSync(entry: TimelineEntry): string[] {
  const baseTags = entry.tags.filter(
    (tag) =>
      !tag.startsWith(LIST_ITEM_TAG_PREFIX) &&
      !tag.startsWith(LIST_GROUP_TAG_PREFIX) &&
      !tag.startsWith(DETECTED_TAG_PREFIX) &&
      !tag.startsWith(CHECKLIST_ITEM_TAG_PREFIX),
  );

  const checklistItemTags = (entry.checklistItems ?? []).map((item) => `${CHECKLIST_ITEM_TAG_PREFIX}${encodeURIComponent(item)}`);
  const listItemTags = (entry.listItems ?? []).map((item) => `${LIST_ITEM_TAG_PREFIX}${encodeURIComponent(item)}`);
  const listGroupTags = (entry.listGroups ?? []).map((group) => `${LIST_GROUP_TAG_PREFIX}${encodeURIComponent(group)}`);
  const detectedTags = (entry.detectedTags ?? []).map((tag) => `${DETECTED_TAG_PREFIX}${encodeURIComponent(tag)}`);

  return [...baseTags, ...checklistItemTags, ...listItemTags, ...listGroupTags, ...detectedTags];
}

export function decodeEntryTagsFromSync(rawTags: string[]): {
  tags: string[];
  checklistItems: string[] | null;
  listItems: string[] | null;
  listGroups: string[] | null;
  detectedTags: string[] | null;
} {
  const tags: string[] = [];
  const checklistItems: string[] = [];
  const listItems: string[] = [];
  const listGroups: string[] = [];
  const detectedTags: string[] = [];

  for (const rawTag of rawTags) {
    if (rawTag.startsWith(CHECKLIST_ITEM_TAG_PREFIX)) {
      checklistItems.push(decodeURIComponent(rawTag.slice(CHECKLIST_ITEM_TAG_PREFIX.length)));
      continue;
    }
    if (rawTag.startsWith(LIST_ITEM_TAG_PREFIX)) {
      listItems.push(decodeURIComponent(rawTag.slice(LIST_ITEM_TAG_PREFIX.length)));
      continue;
    }
    if (rawTag.startsWith(LIST_GROUP_TAG_PREFIX)) {
      listGroups.push(decodeURIComponent(rawTag.slice(LIST_GROUP_TAG_PREFIX.length)));
      continue;
    }
    if (rawTag.startsWith(DETECTED_TAG_PREFIX)) {
      detectedTags.push(decodeURIComponent(rawTag.slice(DETECTED_TAG_PREFIX.length)));
      continue;
    }
    tags.push(rawTag);
  }

  return {
    tags,
    checklistItems: checklistItems.length ? checklistItems : null,
    listItems: listItems.length ? listItems : null,
    listGroups: listGroups.length ? listGroups : null,
    detectedTags: detectedTags.length ? detectedTags : null,
  };
}

const GENERIC_TITLE_WORDS = new Set([
  '',
  'comprar',
  'para',
  'pagar',
  'tomar',
  'hacer',
  'nota',
  'recordatorio',
]);

const PINNED_STORAGE_KEY = 'liev:pinned-entry-ids';

export function formatRelativeDate(dateStr: string): string {
  const today = formatLocalDateKey(new Date());
  const tomorrow = formatLocalDateKey(addDays(new Date(), 1));

  if (dateStr === today) return 'hoy';
  if (dateStr === tomorrow) return 'mañana';

  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long' });
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(amount);
}

export function normalizeEntryText(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function isGenericEntryTitle(title: string): boolean {
  const normalized = normalizeEntryText(title).toLowerCase();
  return GENERIC_TITLE_WORDS.has(normalized) || normalized.length <= 2;
}

export function entryLooksLikePurchase(entry: TimelineEntry): boolean {
  const haystack = `${entry.title} ${entry.text}`.toLowerCase();
  return /\b(comprar|compra|supermercado|feria|mercado)\b/.test(haystack);
}

export function getEntryDisplayType(entry: TimelineEntry): string {
  if (entry.type === 'shopping_list') return 'lista';
  if (entry.type === 'payment') return 'pago';
  if (entry.type === 'health' || entry.type === 'appointment') return 'salud';
  if (entry.type === 'pet') return 'mascota';
  if (entry.type === 'note') return 'nota';
  if (hasDetectedList(entry)) {
    if ((entry.detectedTags ?? []).includes('casa') || (entry.detectedTags ?? []).includes('aseo hogar')) {
      return 'tarea';
    }
    return 'compra';
  }
  if (entryLooksLikePurchase(entry)) return 'compra';
  return 'tarea';
}

export function getEntryDisplayTitle(entry: TimelineEntry): string {
  const normalizedTitle = normalizeEntryText(entry.title);
  const normalizedText = normalizeEntryText(entry.text);

  if (!normalizedTitle || isGenericEntryTitle(normalizedTitle)) {
    return normalizedText || normalizedTitle || 'Sin contenido';
  }

  return normalizedTitle;
}

export function hasDetectedList(entry: TimelineEntry): boolean {
  return !!((entry.listItems?.length ?? 0) > 0 || (entry.listGroups?.length ?? 0) > 0 || (entry.detectedTags?.length ?? 0) > 0);
}

export function getEntrySecondaryText(entry: TimelineEntry, displayTitle?: string): string | null {
  const normalizedText = normalizeEntryText(entry.text);
  if (!normalizedText) return null;

  const comparisonTitle = normalizeEntryText(displayTitle ?? getEntryDisplayTitle(entry)).toLowerCase();
  const lowerText = normalizedText.toLowerCase();

  if (lowerText === comparisonTitle) return null;
  if (isGenericEntryTitle(normalizedText)) return null;
  if (normalizedText.length < 5) return null;

  return normalizedText;
}

export function getEntryStorageKey(entry: TimelineEntry): string {
  if (entry.localId) return entry.localId;
  if (typeof entry.id === 'number') return `id:${entry.id}`;
  return `${entry.type}:${entry.createdAt.getTime()}`;
}

function readPinnedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writePinnedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

export function isEntryPinned(entry: TimelineEntry): boolean {
  return readPinnedIds().has(getEntryStorageKey(entry));
}

export function toggleEntryPinned(entry: TimelineEntry): boolean {
  const ids = readPinnedIds();
  const key = getEntryStorageKey(entry);
  const nextPinned = !ids.has(key);

  if (nextPinned) ids.add(key);
  else ids.delete(key);

  writePinnedIds(ids);
  return nextPinned;
}

export function isOverdue(entry: TimelineEntry): boolean {
  if (entry.done || !entry.date) return false;
  return entry.date < formatLocalDateKey(new Date());
}

export function isThisWeek(entry: TimelineEntry): boolean {
  if (!entry.date) return false;
  const today = formatLocalDateKey(new Date());
  const nextWeek = formatLocalDateKey(addDays(new Date(), 7));
  return entry.date >= today && entry.date <= nextWeek;
}

export function getCalendarEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const today = formatLocalDateKey(new Date());
  const nextWeek = formatLocalDateKey(addDays(new Date(), 7));
  return entries.filter((e) => !!e.date && e.date >= today && e.date <= nextWeek);
}

export function getEntryPriority(entry: TimelineEntry): EntryPriority {
  const text = `${entry.title} ${entry.text} ${entry.tags.join(' ')}`.toLowerCase();
  const today = formatLocalDateKey(new Date());
  const tomorrow = formatLocalDateKey(addDays(new Date(), 1));
  const inTwoDays = formatLocalDateKey(addDays(new Date(), 2));

  if (isOverdue(entry) || /\b(urgente|urgencia|ya|inmediato|ahora)\b/.test(text)) {
    return 'urgent';
  }

  if (!entry.done && entry.date && (entry.date === today || entry.date === tomorrow)) {
    return 'urgent';
  }

  if (
    /\b(importante|prioridad|pronto)\b/.test(text) ||
    (!entry.done && entry.date && entry.date <= inTwoDays) ||
    (entry.type === 'payment' && !entry.done && typeof entry.amount === 'number' && entry.amount >= 50000)
  ) {
    return 'important';
  }

  return 'normal';
}

function extractMomentPhrase(entry: TimelineEntry): string | null {
  const lower = entry.text.toLowerCase();
  const matches = [
    /despu[eé]s del trabajo/,
    /antes de [^,.]+/,
    /en la ma[nñ]ana/,
    /en la tarde/,
    /en la noche/,
    /al salir/,
  ];

  for (const pattern of matches) {
    const hit = lower.match(pattern);
    if (hit) return hit[0];
  }

  return null;
}

function extractPlaceHint(entry: TimelineEntry): string | null {
  const lower = entry.text.toLowerCase();
  if (/\bferia\b/.test(lower)) return 'la feria';
  if (/\bsupermercado\b/.test(lower)) return 'el supermercado';
  if (/\bmercado\b/.test(lower)) return 'el mercado';
  if (/\bvet(erinar)?io\b/.test(lower)) return 'el veterinario';
  if (/\bfarmacia\b/.test(lower)) return 'la farmacia';
  return null;
}

export function getShoppingStage(checkedCount: number, totalCount: number): 'pending' | 'shopping' | 'completed' {
  if (totalCount === 0 || checkedCount === 0) return 'pending';
  if (checkedCount === totalCount) return 'completed';
  return 'shopping';
}

export function getEntryNextStep(entry: TimelineEntry): string {
  if (entry.done) return 'sin siguiente paso';

  if (entry.type === 'shopping_list') return 'marcar ítems al comprar';

  if (hasDetectedList(entry)) {
    if ((entry.listItems?.length ?? 0) <= 2) return 'Agregar productos específicos';
    if (!(entry.text ?? '').match(/\b\d+\s*(kg|g|lt|l|un|uds?)\b/i)) return 'Completar cantidades';
    if (typeof entry.amount !== 'number') return 'Revisar presupuesto estimado';
    return 'Revisar la lista antes de salir';
  }

  const dateLabel = entry.date ? formatRelativeDate(entry.date) : null;
  const placeHint = extractPlaceHint(entry);
  const momentPhrase = extractMomentPhrase(entry);
  const displayType = getEntryDisplayType(entry);

  if (entry.type === 'payment') {
    if (dateLabel && dateLabel !== 'hoy') return `pagar antes de ${dateLabel}`;
    return 'revisar el pago hoy';
  }

  if (displayType === 'compra') {
    if (momentPhrase) return `comprar ${momentPhrase}`;
    if (placeHint) return `recordar ${placeHint}`;
    if (dateLabel) return `comprar ${dateLabel}`;
    return 'dejarlo a mano para la próxima salida';
  }

  if (entry.type === 'health' || entry.type === 'appointment') {
    if (entry.time) return `prepararlo para las ${entry.time}`;
    if (dateLabel) return `revisarlo ${dateLabel}`;
    return 'dejarlo visible para no olvidarlo';
  }

  if (entry.type === 'pet') {
    if (placeHint) return `pasar por ${placeHint}`;
    return 'dejarlo listo para la mascota';
  }

  if (momentPhrase) return `hacerlo ${momentPhrase}`;
  if (dateLabel && dateLabel !== 'hoy') return `retomarlo ${dateLabel}`;
  return 'resolverlo en el siguiente momento libre';
}

export function getEntryCategoryMeaning(entry: TimelineEntry): string {
  const displayType = getEntryDisplayType(entry);

  if (entry.type === 'payment') return 'orden financiero';
  if (entry.type === 'health' || entry.type === 'appointment') return 'cuidado personal';
  if (entry.type === 'pet') return 'cuidado de mascota';
  if (displayType === 'compra') return 'abastecimiento cotidiano';
  if (entry.type === 'note') return 'memoria de apoyo';
  return 'pendiente cotidiano';
}

export function getEntrySemanticInterpretation(entry: TimelineEntry): string {
  if (hasDetectedList(entry)) return 'lista práctica detectada para ordenar compras o pendientes del hogar';
  if (entry.done) return 'resuelto y fuera de la cabeza';
  if (entry.type === 'payment') return 'compromiso financiero pendiente';
  if (entry.type === 'health' || entry.type === 'appointment') return 'recordatorio de cuidado y seguimiento';
  if (entry.type === 'pet') return 'tarea de bienestar para la mascota';
  if (getEntryDisplayType(entry) === 'compra') return 'compra práctica para sostener el día a día';
  if (entry.type === 'note') return 'nota breve para no perder contexto';
  return 'acción concreta que conviene resolver sin fricción';
}

export function getEntryPendingListDetails(entry: TimelineEntry): string {
  if (!hasDetectedList(entry)) return '';
  if ((entry.listItems?.length ?? 0) <= 2) return 'faltan productos más específicos';
  if (!(entry.text ?? '').match(/\b\d+\s*(kg|g|lt|l|un|uds?)\b/i)) return 'faltan cantidades o medidas';
  if (typeof entry.amount !== 'number') return 'todavía no hay presupuesto estimado';
  return 'lista lista para completar o comprar';
}
