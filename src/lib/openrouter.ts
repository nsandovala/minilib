/**
 * OpenRouter configuration — economical model selection and cost tracking.
 *
 * Recommended models (from cheapest to most capable for classification):
 *   1. deepseek/deepseek-chat:free (free tier)
 *   2. qwen/qwen-2.5-7b-instruct (very cheap, ~$0.03/1M tokens)
 *   3. mistralai/mistral-small (good quality, ~$0.20/1M tokens)
 *   4. openai/gpt-4o-mini (best quality, ~$0.15/1M input, $0.60/1M output)
 *
 * Cost budget: $5-10/month for beta. Alert if >$0.50/day.
 */

export const OPENROUTER_MODELS = {
  // Primary: free tier — sufficient for simple classification
  primary: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat:free',
  // Fallback: cheap but reliable
  fallback: process.env.OPENROUTER_FALLBACK_MODEL ?? 'qwen/qwen-2.5-7b-instruct',
};

// Estimated cost per request (USD) — conservative estimates
// Input: ~200 tokens, Output: ~150 tokens
export const COST_PER_REQUEST: Record<string, number> = {
  'deepseek/deepseek-chat:free': 0,
  'deepseek/deepseek-chat': 0.00007,
  'qwen/qwen-2.5-7b-instruct': 0.00005,
  'mistralai/mistral-small': 0.0003,
  'openai/gpt-4o-mini': 0.00015,
  'openai/gpt-4o': 0.0025,
};

// Daily budget limit (USD)
const DAILY_BUDGET_USD = 0.5;

// In-memory daily cost tracking (resets at midnight)
let dailyCost = 0;
let lastResetDate = new Date().toDateString();

function getCost(model: string): number {
  return COST_PER_REQUEST[model] ?? 0.0003;
}

function resetDailyCostIfNeeded() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyCost = 0;
    lastResetDate = today;
  }
}

export function trackCost(model: string): { allowed: boolean; dailyCost: number } {
  resetDailyCostIfNeeded();
  const cost = getCost(model);
  const projected = dailyCost + cost;

  if (projected > DAILY_BUDGET_USD) {
    return { allowed: false, dailyCost };
  }

  dailyCost = projected;
  return { allowed: true, dailyCost };
}

export function getDailyCost(): number {
  resetDailyCostIfNeeded();
  return dailyCost;
}

/**
 * Reduced system prompt for OpenRouter.
 * Moved detailed semantic rules to code (Zod schema) to save tokens and reduce prompt injection.
 */
export const SYSTEM_PROMPT = `Clasifica texto en español chileno. Devuelve SOLO JSON, sin markdown.

Schema:
{
  "type": "note" | "task" | "shopping_list" | "payment" | "health" | "pet" | "calendar",
  "surface": "notes" | "todos" | "purchases" | "payments" | "health" | "pets" | "appointments",
  "title": string,
  "summary": string | null,
  "date_text": string | null,
  "time": string | null,
  "amount": number | null,
  "currency": "CLP" | null,
  "priority": "low" | "normal" | "urgent" | null,
  "status": "pending" | "paid" | "completed" | null,
  "store_context": string | null,
  "storeType": "supermercado" | "farmacia" | "feria" | "minimarket" | "botilleria" | "mall" | "mall_chino" | "panaderia" | "carniceria" | "verduleria" | "otro" | null,
  "checklist_items": string[],
  "tags": string[],
  "confidence": number,
  "reason": string
}

Reglas:
- Fechas (hoy, mañana, lunes...) van en date_text, NUNCA en checklist_items.
- Tiendas (supermercado, farmacia...) van en store_context, NUNCA en checklist_items.
- Preposiciones (para, en, el, de...) NUNCA en checklist_items.
- Solo montos con contexto financiero explícito ($, CLP, pagar, pago). Años como 2026 NO son montos.
- confidence: claro >0.85, ambiguo 0.55-0.75, muy ambiguo <0.55 → note.
- NO inventes datos. NO uses markdown.`;
