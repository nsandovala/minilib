import { NextRequest, NextResponse } from 'next/server';
import { buildHeuristicRadarResult, normalizeRadarResult, shouldUseAI } from '@/core/cognitive/normalize-radar-result';
import { RadarCardSchemaStrict } from '@/core/contracts/card-contracts';
import type { RadarCardContract } from '@/core/contracts/card-contracts';
import { rateLimit } from '@/lib/rate-limit';
import { OPENROUTER_MODELS, SYSTEM_PROMPT, trackCost } from '@/lib/openrouter';

const MAX_TEXT_LENGTH = 2000;

const OPENROUTER_MODEL = OPENROUTER_MODELS.primary;
const OPENROUTER_FALLBACK_MODEL = OPENROUTER_MODELS.fallback;

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

// ─── Safe logs ────────────────────────────────────────────────────────────────

function logRadarContract(text: string, data: RadarCardContract, fallbackUsed: boolean, schemaValidationOk: boolean) {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[radar] contract', {
    inputLength: text.length,
    detectedType: data.type,
    schemaValidationOk,
    fallbackUsed,
    amount: data.amount,
    dateText: data.date_text,
    storeType: data.storeType,
    itemCount: data.checklist_items.length,
  });
}

function localFallbackResponse(text: string, localData: RadarCardContract, reason: string) {
  logRadarContract(text, localData, true, true);
  return NextResponse.json({ ...localData, reason }, { status: 200 });
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
  let requestText = '';
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const bodyObj = body as Record<string, unknown>;
    const text = typeof bodyObj.text === 'string' ? bodyObj.text.trim() : '';
    requestText = text;
    if (!text) {
      return NextResponse.json({ error: 'empty_text' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'text_too_long' }, { status: 400 });
    }

    // ─── Rate limiting ───────────────────────────────────────────────────────
    const clientIp = req.headers.get('x-forwarded-for') ?? req.ip ?? 'unknown';
    const limit = rateLimit(clientIp, { windowMs: 60_000, maxRequests: 20 });
    if (!limit.allowed) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[radar] rate limit exceeded', { clientIp, remaining: limit.remaining });
      }
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    // ─── Local-first: try heuristic before AI ─────────────────────────────────
    const localCandidate = buildHeuristicRadarResult(text);
    const localResult = normalizeRadarResult(localCandidate, text);

    if (!localResult.ok || !localResult.data) {
      return NextResponse.json({ error: 'local_parsing_failed' }, { status: 500 });
    }

    if (!shouldUseAI(text, localResult.data)) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[radar] local-first hit', {
          inputLength: text.length,
          detectedType: localResult.data.type,
          confidence: localResult.data.confidence,
          itemCount: localResult.data.checklist_items.length,
          dateText: localResult.data.date_text,
          amount: localResult.data.amount,
        });
      }
      logRadarContract(text, localResult.data, false, true);
      return NextResponse.json(localResult.data);
    }

    // ─── OpenRouter path (ambiguous cases only) ────────────────────────────────
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || !OPENROUTER_MODEL) {
      return localFallbackResponse(text, localResult.data, 'openrouter_not_configured');
    }

    // Cost budget check
    const costCheck = trackCost(OPENROUTER_MODEL);
    if (!costCheck.allowed) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[radar] daily cost budget exceeded', { dailyCost: costCheck.dailyCost });
      }
      return localFallbackResponse(text, localResult.data, 'cost_budget_exceeded');
    }

    let orRes = await openRouterFetch(OPENROUTER_MODEL, text, apiKey);

    if (!orRes.ok) {
      const primaryErrBody = await orRes.text().catch(() => '');
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[radar] OpenRouter primary failed', {
          status: orRes.status,
          model: OPENROUTER_MODEL,
          messageLength: primaryErrBody.length,
        });
      }

      if (RETRIABLE_STATUSES.has(orRes.status) && OPENROUTER_FALLBACK_MODEL) {
        const fallbackCostCheck = trackCost(OPENROUTER_FALLBACK_MODEL);
        if (!fallbackCostCheck.allowed) {
          return localFallbackResponse(text, localResult.data, 'cost_budget_exceeded');
        }
        orRes = await openRouterFetch(OPENROUTER_FALLBACK_MODEL, text, apiKey);
        if (!orRes.ok) {
          const fallbackErrBody = await orRes.text().catch(() => '');
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[radar] OpenRouter fallback failed', {
              status: orRes.status,
              model: OPENROUTER_FALLBACK_MODEL,
              messageLength: fallbackErrBody.length,
            });
          }
          return localFallbackResponse(text, localResult.data, 'openrouter_provider_error');
        }
      } else {
        if ([400, 401, 403, 404, 429].includes(orRes.status)) {
          return localFallbackResponse(text, localResult.data, 'openrouter_provider_error');
        }
        return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
      }
    }

    const orData = await orRes.json() as { choices?: { message?: { content?: unknown } }[] };
    const content = orData?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content) {
      return localFallbackResponse(text, localResult.data, 'empty_response');
    }

    const parsed = extractJson(content);
    if (!parsed) {
      return localFallbackResponse(text, localResult.data, 'invalid_json');
    }

    // Try strict schema first — if AI returns garbage, we want to know
    const strictResult = RadarCardSchemaStrict.safeParse(parsed);
    if (!strictResult.success) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[radar] AI response failed strict validation', {
          inputLength: text.length,
          issues: strictResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        });
      }
      // Fallback to lenient normalization for partial data recovery
      const lenientResult = normalizeRadarResult(parsed, text);
      if (!lenientResult.ok || !lenientResult.data) {
        return localFallbackResponse(text, localResult.data, 'invalid_ai_payload');
      }
      logRadarContract(text, lenientResult.data, true, true);
      return NextResponse.json(lenientResult.data);
    }

    // Strict validation passed — normalize to fill computed fields
    const normalized = normalizeRadarResult(strictResult.data, text);
    if (!normalized.ok || !normalized.data) {
      return localFallbackResponse(text, localResult.data, 'invalid_ai_payload');
    }

    logRadarContract(text, normalized.data, false, true);
    return NextResponse.json(normalized.data);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'AbortError' || err.name === 'TimeoutError')
    ) {
      if (requestText) {
        const localFallback = buildHeuristicRadarResult(requestText);
        return localFallbackResponse(requestText, localFallback, 'timeout');
      }
      return NextResponse.json({ error: 'timeout' }, { status: 200 });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
