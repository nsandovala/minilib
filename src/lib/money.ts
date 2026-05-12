/**
 * Normaliza montos en pesos chilenos (CLP) desde texto natural.
 *
 * Soporta:
 * - "2.900"       → 2900
 * - "$2.900"      → 2900
 * - "12.500"      → 12500
 * - "220.000"     → 220000
 * - "15k"         → 15000
 * - "2 lucas"     → 2000
 * - "1500"        → 1500
 * - "$ 3.990"     → 3990
 *
 * No soporta decimales reales (ej. "2.5" como 2.5); en Chile el punto
 * es separador de miles.
 */
export function normalizeCLP(raw: string): number | null {
  const cleaned = raw.replace(/^\$?\s*/, '').trim().toLowerCase();

  // "15k" → 15000
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*k$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }

  // "2 lucas" → 2000
  const lucasMatch = cleaned.match(/^(\d+(?:[.,]\d{3})?)\s*lucas?$/);
  if (lucasMatch) {
    const numStr = lucasMatch[1].replace(/[.,]/g, '');
    return parseInt(numStr, 10);
  }

  // "2.900", "12.500", "220.000", "1500"
  // Requiere que el punto o coma aparezca solo como separador de miles
  // (grupos de exactamente 3 dígitos después del separador)
  const clpMatch = cleaned.match(/^(\d{1,3}(?:[.,]\d{3})+|\d{3,})$/);
  if (clpMatch) {
    const numStr = clpMatch[1].replace(/[.,]/g, '');
    const num = parseInt(numStr, 10);
    if (num >= 0 && num <= 100_000_000) return num;
  }

  // Fallback: cualquier número entero puro >= 100
  const plainMatch = cleaned.match(/^(\d+)$/);
  if (plainMatch) {
    const num = parseInt(plainMatch[1], 10);
    if (num >= 100 && num <= 100_000_000) return num;
  }

  return null;
}


