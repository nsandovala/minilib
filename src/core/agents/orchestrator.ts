import { safetyCheck, type SafetyResult } from './safety-agent';
import { parseTokens, type ExtractedTokens } from './parser-agent';
import { normalizeEntry, detectType } from './normalizer-agent';
import type { ParsedEntry, EntryType } from '@/types';

export interface ProcessedEntry {
  success: boolean;
  entry?: ParsedEntry;
  error?: string;
}

export interface PreviewResult {
  type: EntryType;
  date: string | null;
  time: string | null;
  amount: number | null;
}

export function processInput(rawText: string): ProcessedEntry {
  const safety: SafetyResult = safetyCheck(rawText);

  if (!safety.valid) {
    return { success: false, error: safety.error };
  }

  const tokens: ExtractedTokens = parseTokens(safety.text);
  const entry: ParsedEntry = normalizeEntry(tokens);

  return { success: true, entry };
}

export function previewInput(rawText: string): PreviewResult | null {
  if (!rawText || rawText.trim().length <= 2) return null;

  const safety: SafetyResult = safetyCheck(rawText);
  if (!safety.valid) return null;

  const tokens: ExtractedTokens = parseTokens(safety.text);
  const type: EntryType = detectType(tokens);

  return {
    type,
    date: tokens.date,
    time: tokens.time,
    amount: tokens.amount,
  };
}
