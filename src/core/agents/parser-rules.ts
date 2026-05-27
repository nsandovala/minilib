export type ListEntryType = 'shopping_list' | 'health' | 'pet';

function normalizeIntentText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

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
  const lower = normalizeIntentText(text);
  const hasPetNoun = /\b(mascota|mascotas|perro|perrita|perrito|perra|gato|gata|gatito|gatita|can|felino)\b/.test(lower);
  const hasKnownPetName = /\b(luna|rocky|saly|thor|max|firulais|michi|michi[sz])\b/.test(lower);
  const hasNamedPetContext = /\b(a|para)\s+(?:la\s+|el\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/.test(text);
  // Veterinary / medical — always concrete
  if (/\b(veterinario|veterinaria|\bvet\b|vacuna|vacunar|desparasit|pipeta|pulgas|garrapata)\b/.test(lower)) return true;
  // Medication becomes pet-specific only when paired with explicit pet context or pet-like proper-name context
  if (/\b(pastilla|remedio|medicamento|medicina|jarabe|dosis)\b/.test(lower) && (hasPetNoun || hasNamedPetContext || hasKnownPetName)) return true;
  // Grooming / care with explicit animal reference
  if (/\b(baño|bañar|corte\s+de\s+pelo|peluquer[ií]a)\b.{0,40}\b(perro|gato|gata|mascota|can)\b/.test(lower)) return true;
  if (/\b(perro|gato|gata|mascota)\b.{0,30}\b(baño|bañar|corte|peluquer[ií]a|control)\b/.test(lower)) return true;
  if (/\b(banar|bañar|bano|baño|cortar\s+unas|cortar\s+uñas|corte\s+de\s+pelo|peluqueria|peluquería)\b/.test(lower) && (hasPetNoun || hasNamedPetContext || hasKnownPetName)) return true;
  // Food / supplies near an animal word
  if (/\b(comida|alimento|croqueta|pienso)\b.{0,20}\b(perro|gato|gata|mascota|can|felino)\b/.test(lower)) return true;
  if (/\b(perro|gato|gata|mascota)\b.{0,20}\b(comida|alimento|croqueta|correa|collar)\b/.test(lower)) return true;
  // Cat litter
  if (/\b(arena|arenero)\b.{0,15}\b(gato|gata)\b/.test(lower)) return true;
  if (/\b(gato|gata)\b.{0,15}\b(arena|arenero)\b/.test(lower)) return true;
  // llevar / ir + vet or animal
  if (/\b(llevar|ir|dar)\b.{0,40}\b(veterinario|vet|perro|gato|gata|mascota)\b/.test(lower)) return true;
  return false;
}

export function hasIncomeIntent(text: string): boolean {
  const lower = normalizeIntentText(text);
  return /\b(me pagaron|nos pagaron|pagaron|ingreso|sueldo|venta|deposito|depositaron|transferencia recibida|entr[oó]|recibi|recib[íi])\b/.test(lower);
}

export function hasConceptualNoteIntent(text: string): boolean {
  const lower = normalizeIntentText(text);
  return /\b(idea|analizar|analisis|mejorar|habilitar|investigar|investigacion|posibilidad|integracion|herramientas|futuro|redisenar|rediseñar|implementar|mas adelante|informe|concepto|documento|modulo|ux|roadmap|backlog)\b/.test(lower);
}

export function hasPassiveExpenseIntent(text: string): boolean {
  const lower = normalizeIntentText(text);
  return /\b(tabaco|cigarro|cigarros|bebida|bebidas|cerveza|bencina|peaje)\b/.test(lower);
}

export function hasHealthIntent(text: string): boolean {
  const lower = normalizeIntentText(text);
  if (hasPetAction(text)) return false;

  if (/\b(doctor|doctora|medico|medica|dentista|kine|kinesiologo|kinesiologa|terapia|consulta|control medico|cita medica|examen|clinica|hospital)\b/.test(lower)) {
    return true;
  }

  const hasMedicineWord = /\b(remedio|medicamento|medicina|pastilla|jarabe|dosis|vitamina|insulina|comprimido|inyeccion)\b/.test(lower);
  const hasHumanCareVerb = /\b(tomar|ir\s+al?|ir\s+a\s+la|pedir|agendar|hacerme|hacer|comprar|buscar|retirar|controlar)\b/.test(lower);
  const hasHumanBodySignal = /\b(fiebre|dolor|presion|temperatura|sintoma|malestar|cuerpo|cabeza|garganta)\b/.test(lower);

  if (hasMedicineWord && (hasHumanCareVerb || hasHumanBodySignal)) return true;
  return false;
}

/**
 * True when text signals intent to buy / shop.
 */
export function hasShoppingIntent(text: string): boolean {
  if (/\b(modulo|m[oó]dulo|flujo|categor[ií]a|investigaci[oó]n|an[aá]lisis)\b/i.test(text)) return false;
  return /\b(comprar|compras?|lista\s+(?:de\s+)?(?:compras?|super(?:mercado)?|super)|compras?\s+del\s+super|supermercado|super|minimarket|almac[eé]n|feria|mercado|farmacia|tabaquer[ií]a|ferreter[ií]a|verduler[ií]a|carnicer[ií]a|panader[ií]a|despensa|\bingredientes\b)\b/i.test(text);
}

export function hasExpensePurchaseIntent(text: string): boolean {
  const lower = normalizeIntentText(text);
  if (hasPetAction(text)) return false;
  return /\b(comprar|compra|compre|compre\b|compr[eé]|gaste|gaste\b|gast[eé])\b/.test(lower);
}

/**
 * True when text signals a payment obligation or financial transaction.
 */
export function hasPaymentIntent(text: string): boolean {
  return /\b(pagar|abonar|transferir|cobrar|depositar)\b/i.test(text)
    || /\b(vencimiento|suscripci[oó]n|cuota\s+de|arriendo|hipoteca|pr[eé]stamo)\b/i.test(text)
    || /\bfactura\s+(de|del?|pendiente|venc)/i.test(text);
}

/**
 * True when text signals a project, tech integration, or product-development intent.
 * Used as a negative guard so project/idea notes are never classified as shopping lists.
 */
export function hasProjectIntent(text: string): boolean {
  if (/\b(habilitar|implementar|redise[ñn]ar|migrar|desarrollar|optimizar|sketchnoting|roadmap|backlog|sprint|ingests?|analizar|mejorar|investigar|integraci[oó]n|herramientas|futuro|informe|idea|concepto)\b/i.test(text)) return true;
  if (/\b(gmail|github|figma|notion|jira|asana|trello|dropbox|drive|photos|slack|linear|confluence)\b/i.test(text)) return true;
  return false;
}
