export type ListEntryType = 'shopping_list' | 'health' | 'pet';

export function hasExplicitListIntent(text: string): boolean {
  return /\blista\b/i.test(text) || /[,;/]/.test(text) || /\n/.test(text) || /\s+y\s+/i.test(text);
}

export function shouldBuildShoppingList(params: {
  itemCount: number;
  explicitListIntent: boolean;
  hasStoreKeyword: boolean;
  hasKnownCategory: boolean;
}): boolean {
  const { itemCount, explicitListIntent, hasStoreKeyword, hasKnownCategory } = params;
  if (itemCount < 1) return false;
  if (itemCount < 2 && !explicitListIntent) return false;
  if (itemCount < 2 && !hasStoreKeyword && !hasKnownCategory) return false;
  // Require at least one concrete shopping signal to avoid false positives
  // with conceptual lists like "Ideas, mascotas, salud, pendientes"
  if (!hasStoreKeyword && !hasKnownCategory) return false;
  return true;
}

export function resolveListEntryType(detectedTags: string[]): ListEntryType {
  if (detectedTags.includes('mascotas')) return 'pet';
  if (detectedTags.includes('farmacia')) return 'health';
  return 'shopping_list';
}

/**
 * True when text is long-form, structured, or document-like.
 * These should always be classified as 'note' regardless of keywords.
 */
export function isLongFormNote(text: string): boolean {
  if (text.length > 500) return true;
  // Markdown headings
  if (/^#{1,3}\s+\S/m.test(text)) return true;
  // Two or more numbered sections
  if ((text.match(/^\d+\.\s+\S/gm) ?? []).length >= 2) return true;
  // Six or more line breaks (document-like)
  if ((text.match(/\n/g) ?? []).length >= 6) return true;
  // Two or more titled sections (e.g. "Visión Estratégica:")
  if ((text.match(/^[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]{4,40}:\s*$/gm) ?? []).length >= 2) return true;
  return false;
}

/**
 * True only when text contains a *concrete* pet care action.
 * The word "mascotas" alone as a category/topic does NOT qualify.
 */
export function hasPetAction(text: string): boolean {
  const lower = text.toLowerCase();
  // Veterinary / medical — always concrete
  if (/\b(veterinario|veterinaria|\bvet\b|vacuna|vacunar|desparasit|pipeta|pulgas|garrapata)\b/.test(lower)) return true;
  // Grooming / care with explicit animal reference
  if (/\b(baño|bañar|corte\s+de\s+pelo|peluquer[ií]a)\b.{0,40}\b(perro|gato|mascota|can)\b/.test(lower)) return true;
  if (/\b(perro|gato|mascota)\b.{0,30}\b(baño|bañar|corte|peluquer[ií]a|control)\b/.test(lower)) return true;
  // Food / supplies near an animal word
  if (/\b(comida|alimento|croqueta|pienso)\b.{0,20}\b(perro|gato|mascota|can|felino)\b/.test(lower)) return true;
  if (/\b(perro|gato|mascota)\b.{0,20}\b(comida|alimento|croqueta|correa|collar)\b/.test(lower)) return true;
  // Cat litter
  if (/\b(arena|arenero)\b.{0,15}\bgato\b/.test(lower)) return true;
  if (/\bgato\b.{0,15}\b(arena|arenero)\b/.test(lower)) return true;
  // llevar / ir + vet or animal
  if (/\b(llevar|ir)\b.{0,40}\b(veterinario|vet|perro|gato|mascota)\b/.test(lower)) return true;
  return false;
}

/**
 * True when text signals intent to buy / shop.
 */
export function hasShoppingIntent(text: string): boolean {
  return /\b(comprar|lista\s+(?:de\s+)?(?:compras?|super(?:mercado)?)|supermercado|\bferia\b|ingredientes)\b/i.test(text);
}

/**
 * True when text signals a payment obligation or financial transaction.
 */
export function hasPaymentIntent(text: string): boolean {
  return /\b(pagar|abonar|transferir|cobrar|depositar)\b/i.test(text)
    || /\b(vencimiento|suscripci[oó]n|cuota\s+de|arriendo|hipoteca|pr[eé]stamo)\b/i.test(text)
    || /\bfactura\s+(de|del?|pendiente|venc)/i.test(text);
}
