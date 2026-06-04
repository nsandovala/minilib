import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_TEXT_LENGTH = 2000;
const OPENROUTER_MODEL          = process.env.OPENROUTER_MODEL;
const OPENROUTER_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL;

// ─── Zod schema ───────────────────────────────────────────────────────────────

const RadarSchema = z.object({
  type:            z.enum(['note', 'task', 'shopping_list', 'payment', 'health', 'pet', 'calendar', 'home']),
  surface:         z.enum(['notes', 'todos', 'purchases', 'payments', 'health', 'pets', 'appointments', 'home']).catch('notes'),
  title:           z.string().min(1).transform(s => s.trim()),
  summary:         z.string().nullable().catch(null),
  date_text:       z.string().nullable().catch(null),
  time:            z.string().nullable().catch(null),
  amount:          z.number().nonnegative().nullable().catch(null),
  currency:        z.literal('CLP').nullable().catch(null),
  priority:        z.enum(['low', 'normal', 'urgent']).nullable().catch(null),
  status:          z.enum(['pending', 'paid', 'completed']).nullable().catch(null),
  store_context:   z.string().nullable().catch(null),
  checklist_items: z.array(z.string()).catch([]),
  tags:            z.array(z.string()).catch([]),
  confidence:      z.number().transform(n => Math.min(1, Math.max(0, n))).catch(0),
  reason:          z.string().catch(''),
});

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un clasificador semántico de entradas cotidianas en español chileno.
Recibes texto libre de un usuario y debes analizarlo para devolver SOLO JSON válido.

REGLAS CRÍTICAS (obligatorias):
- Responde SOLO con JSON válido. Sin markdown. Sin \`\`\`. Sin explicaciones fuera del JSON.
- NUNCA inventes datos que el usuario no mencionó explícitamente.
- NUNCA conviertas años en dinero. "2026", "2027", "2028" son años, no montos.
  Solo detecta amount si hay "$", "CLP", "pesos", "luca", "lucas", "mil", "pagar", "pago", "mensualidad", "cuenta", "cobrar", "vale" u otro contexto financiero claro.
- Las fechas (sábado, domingo, lunes, martes, miércoles, jueves, viernes, hoy, mañana) JAMÁS son checklist_items. Siempre van en date_text.
- Los nombres de tiendas (supermercado, minimarket, farmacia, feria, mall, botillería, panadería) JAMÁS son checklist_items. Siempre van en store_context.

Schema que debes devolver:
{
  "type": "note" | "task" | "shopping_list" | "payment" | "health" | "pet" | "calendar" | "home",
  "surface": "notes" | "todos" | "purchases" | "payments" | "health" | "pets" | "appointments" | "home",
  "title": string,
  "summary": string | null,
  "date_text": string | null,
  "time": string | null,
  "amount": number | null,
  "currency": "CLP" | null,
  "priority": "low" | "normal" | "urgent" | null,
  "status": "pending" | "paid" | "completed" | null,
  "store_context": string | null,
  "checklist_items": string[],
  "tags": string[],
  "confidence": number,
  "reason": string
}

REGLAS SEMÁNTICAS:

1. FECHAS - Nunca son ítems de lista:
   Palabras de día: lunes, martes, miércoles, jueves, viernes, sábado, domingo.
   Palabras relativas: hoy, mañana, pasado mañana.
   Frases: "para el jueves", "el sábado", "este viernes".
   SIEMPRE van en date_text. JAMÁS en checklist_items.

2. PREPOSICIONES - Nunca son ítems:
   para, en, el, la, los, las, de, del, al, con, sin → JAMÁS en checklist_items.

3. COMPRAS (type: shopping_list, surface: purchases):
   Señales: comprar, compras, lista, supermercado, minimarket, feria, farmacia, negocio.
   - Ítems reales → checklist_items (sin fechas, sin tienda, sin preposiciones, sin "comprar")
   - Tienda → store_context
   - Fecha → date_text
   Ejemplos:
   "sábado comprar pan leche bebida en minimarket" → shopping_list, date_text: "sábado", store_context: "minimarket", checklist_items: ["pan","leche","bebida"]
   "compras farmacia cepillo de dientes pregabalina para el jueves" → shopping_list, store_context: "farmacia", date_text: "jueves", checklist_items: ["cepillo de dientes","pregabalina"]
   "comprar en la feria papas tomate lechuga" → shopping_list, store_context: "feria", checklist_items: ["papas","tomate","lechuga"]

4. PAGOS (type: payment, surface: payments):
   Señales: pagar, pago, cancelar cuenta, luz, agua, internet, arriendo, dividendo, cuenta, mensualidad.
   Con monto o servicio identificado → payment.
   Ejemplo: "pagar internet 12990 hoy" → payment, amount: 12990, currency: "CLP", date_text: "hoy"
   Ejemplo: "pago mensualidad escuela hijo 15000" → payment, amount: 15000, currency: "CLP"
   JAMÁS uses años como amount. "buscar vuelos diciembre 2026" → amount: null.

5. SALUD (type: health, surface: health):
   Señales: médico, doctor, kine, kinesiólogo, terapia, remedio, pastilla (sin mascota), control, examen, hospital, clínica.
   Excepción: si menciona mascota explícitamente → pet.
   Ejemplo: "ir al médico sábado 15:00 urgente" → health, date_text: "sábado", time: "15:00", priority: "urgent"

6. MASCOTAS (type: pet, surface: pets):
   Señales: gata, gato, perro, perrita, mascota, veterinario.
   Ejemplo: "pastilla para la gata Luna lunes 9am" → pet, date_text: "lunes", time: "09:00"

7. CALENDARIO (type: calendar, surface: appointments):
   Solo eventos generales: reunión, partido, cumpleaños, cita no médica, evento, junta, cine, compromiso, gym.
   Si es médico → health. Si es de mascota → pet.
   Ejemplo: "ir al gym el miércoles desde las 19:30" → calendar, surface: appointments, date_text: "miércoles", time: "19:30"

8. NOTAS (type: note, surface: notes):
   Ideas abstractas, reflexiones, planes de producto, texto largo sin acción clara.
   Búsquedas y planes de viaje → note (amount: null aunque mencionen años).
   Ejemplo: "buscar vuelos diciembre 2026 para luna de miel" → note, amount: null

9. checklist_items SOLO contiene ítems reales. Nunca incluir:
   - Días (lunes, sábado, etc.) ni fechas
   - Nombre de tienda
   - Palabras vacías: comprar, compras, lista, para, en, el, la, de, del

10. AMOUNTS - Solo cuando hay contexto financiero explícito:
    Señales válidas: $, CLP, pesos, luca, lucas, mil, pagar, pago, mensualidad, cuenta, cobrar, vale, costó.
    NUNCA años (2025, 2026, 2027, 2028) como amount.

11. CONFIDENCE:
    - Clasificación clara: > 0.85
    - Ambigüedad leve: 0.55–0.75
    - Muy ambiguo: < 0.55 → type: "note", surface: "notes"

Responde SOLO con JSON válido. Sin markdown. Sin explicaciones fuera del JSON.`;

// ─── JSON extraction (handles markdown-wrapped responses) ─────────────────────

function extractJson(content: string): Record<string, unknown> | null {
  try {
    const r: unknown = JSON.parse(content);
    if (r && typeof r === 'object' && !Array.isArray(r)) return r as Record<string, unknown>;
  } catch { /* continue */ }

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) {
    try {
      const r: unknown = JSON.parse(fenced[1]);
      if (r && typeof r === 'object' && !Array.isArray(r)) return r as Record<string, unknown>;
    } catch { /* continue */ }
  }

  const start = content.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < content.length; i++) {
    const ch = content[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          const r: unknown = JSON.parse(content.slice(start, i + 1));
          if (r && typeof r === 'object' && !Array.isArray(r)) return r as Record<string, unknown>;
        } catch { /* continue */ }
        break;
      }
    }
  }
  return null;
}

// ─── Defensive normalization ──────────────────────────────────────────────────

const FINANCIAL_KEYWORDS = [
  '$', 'clp', 'peso', 'pesos', 'luca', 'lucas', 'mil',
  'pagar', 'pago', 'mensualidad', 'cuenta', 'deuda', 'transferencia',
  'depositar', 'cobrar', 'vale', 'costó', 'costo', 'comprar por',
];

// More specific patterns must come first
const STORE_PATTERNS: [RegExp, string][] = [
  [/mall\s*chino/i,   'mall_chino'],
  [/minimarket/i,     'minimarket'],
  [/supermercado/i,   'supermercado'],
  [/\bsuper\b/i,      'supermercado'],
  [/farmacia/i,       'farmacia'],
  [/botiller[ií]a/i,  'botilleria'],
  [/panader[ií]a/i,   'panaderia'],
  [/carnizer[ií]a/i,  'carniceria'],
  [/verduler[ií]a/i,  'verduleria'],
  [/\bferia\b/i,      'feria'],
  [/\bmall\b/i,       'mall'],
];

const TYPE_TO_SURFACE: Record<string, string> = {
  shopping_list: 'purchases',
  payment:       'payments',
  calendar:      'appointments',
  health:        'health',
  pet:           'pets',
  note:          'notes',
  task:          'todos',
  home:          'home',
};

const CHECKLIST_DATE_STORE_WORDS = new Set([
  'sábado', 'sabado', 'domingo', 'lunes', 'martes', 'miércoles', 'miercoles',
  'jueves', 'viernes', 'mañana', 'manana', 'hoy', 'pasado',
  'comprar', 'compra', 'compras', 'lista',
  'supermercado', 'minimarket', 'farmacia', 'feria',
  'botillería', 'botilleria', 'mall', 'panadería', 'panaderia',
  'carnicería', 'carniceria', 'verdulería', 'verduleria',
  'en', 'para', 'de', 'del', 'al', 'el', 'la',
]);

function hasFinancialContext(text: string): boolean {
  const lower = text.toLowerCase();
  return FINANCIAL_KEYWORDS.some(kw => lower.includes(kw));
}

function inferStoreContext(rawText: string, existing: string | null): string | null {
  for (const [pattern, name] of STORE_PATTERNS) {
    if (pattern.test(rawText)) return name;
  }
  return existing;
}

function normalizeRadarCandidate(
  raw: Record<string, unknown>,
  rawText: string,
): Record<string, unknown> {
  const c: Record<string, unknown> = { ...raw };

  // Coerce string amount — Chilean format "15.000" → 15000
  if (typeof c.amount === 'string') {
    const n = Number((c.amount as string).replace(/\./g, '').replace(',', '.'));
    c.amount = isFinite(n) && n >= 0 ? n : null;
  }

  // Year-as-money guard: 1900–2100 without financial context → null
  if (typeof c.amount === 'number' && c.amount >= 1900 && c.amount <= 2100 && !hasFinancialContext(rawText)) {
    c.amount = null;
    c.currency = null;
  }

  // Surface forced from type — prevents model from returning wrong surface
  const type = typeof c.type === 'string' ? c.type : 'note';
  if (TYPE_TO_SURFACE[type]) c.surface = TYPE_TO_SURFACE[type];

  // Store context inferred from raw text (more reliable than model output)
  c.store_context = inferStoreContext(rawText, typeof c.store_context === 'string' ? c.store_context : null);

  // Checklist: remove dates, stores, connectors the model may have included
  if (Array.isArray(c.checklist_items)) {
    c.checklist_items = (c.checklist_items as unknown[]).filter((item) => {
      if (typeof item !== 'string') return false;
      const lower = item.trim().toLowerCase();
      return lower.length >= 2 && !CHECKLIST_DATE_STORE_WORDS.has(lower);
    });
  }

  // Title fallback
  if (!c.title || typeof c.title !== 'string' || !(c.title as string).trim()) {
    c.title = rawText.slice(0, 100);
  }

  return c;
}

// ─── OpenRouter fetch helper ──────────────────────────────────────────────────

function openRouterFetch(model: string, text: string, apiKey: string): Promise<Response> {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://minilib.app',
      'X-Title': 'Liev RADAR',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(8000),
  });
}

const RETRIABLE_STATUSES = new Set([400, 404, 429, 502]);

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const bodyObj = body as Record<string, unknown>;
    const text = typeof bodyObj.text === 'string' ? bodyObj.text.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'empty_text' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'text_too_long' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || !OPENROUTER_MODEL) {
      return NextResponse.json(
        { ok: false, source: 'fallback', reason: 'openrouter_not_configured' },
        { status: 200 },
      );
    }

    let orRes = await openRouterFetch(OPENROUTER_MODEL, text, apiKey);

    if (!orRes.ok) {
      const primaryErrBody = await orRes.text().catch(() => '');
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[radar] OpenRouter primary failed', {
          status: orRes.status,
          model: OPENROUTER_MODEL,
          message: primaryErrBody.slice(0, 300),
        });
      }

      if (RETRIABLE_STATUSES.has(orRes.status) && OPENROUTER_FALLBACK_MODEL) {
        orRes = await openRouterFetch(OPENROUTER_FALLBACK_MODEL, text, apiKey);
        if (!orRes.ok) {
          const fallbackErrBody = await orRes.text().catch(() => '');
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[radar] OpenRouter fallback failed', {
              status: orRes.status,
              model: OPENROUTER_FALLBACK_MODEL,
              message: fallbackErrBody.slice(0, 300),
            });
            console.warn('[radar] fallback=heuristic');
          }
          return NextResponse.json(
            { ok: false, source: 'fallback', reason: 'openrouter_provider_error', providerStatus: orRes.status },
            { status: 200 },
          );
        }
      } else {
        if (process.env.NODE_ENV !== 'production') console.warn('[radar] fallback=heuristic');
        if ([400, 401, 403, 404, 429].includes(orRes.status)) {
          return NextResponse.json(
            { ok: false, source: 'fallback', reason: 'openrouter_provider_error', providerStatus: orRes.status },
            { status: 200 },
          );
        }
        return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
      }
    }

    const orData = await orRes.json() as { choices?: { message?: { content?: unknown } }[] };
    const content = orData?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content) {
      return NextResponse.json(
        { ok: false, source: 'fallback', reason: 'empty_response' },
        { status: 200 },
      );
    }

    const parsed = extractJson(content);
    if (!parsed) {
      return NextResponse.json(
        { ok: false, source: 'fallback', reason: 'invalid_json' },
        { status: 200 },
      );
    }

    const normalized = normalizeRadarCandidate(parsed, text);
    const result = RadarSchema.safeParse(normalized);
    if (!result.success) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[radar] Zod validation failed', result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
      }
      return NextResponse.json(
        { ok: false, source: 'fallback', reason: 'invalid_ai_payload' },
        { status: 200 },
      );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'AbortError' || err.name === 'TimeoutError')
    ) {
      return NextResponse.json(
        { ok: false, source: 'fallback', reason: 'timeout' },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
