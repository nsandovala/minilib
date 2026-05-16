// Server-only: deterministic dedupe_key for cloud-level entry deduplication.
//
// Unlike buildEntryFingerprint (which includes time-bucketed createdAt to match
// entries from nearby sync windows), this key is STABLE across devices and time:
// it encodes only semantic content that the user intentionally set.
//
// Design decisions:
//   - userId is included in the hash for defense-in-depth (the DB partial unique
//     index on (user_id, dedupe_key) is the primary enforcement layer).
//   - createdAt, localId, tags, metadata, and done state are intentionally excluded:
//     they vary across devices or change without making two entries semantically distinct.
//   - The key is returned as a short opaque hash (prefix "dk:") — no raw user text
//     is stored in the dedupe_key column.
//
// No @/ imports — this file is imported directly in scripts and tests via relative paths.

export interface DedupeKeyInput {
  userId:     string;
  type:       string;
  title:      string | null | undefined;
  text:       string | null | undefined;
  date:       string | null | undefined;
  entryTime:  string | null | undefined;
  amount:     number | null | undefined;
}

function normalizeForKey(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?¿¡;:'"]+/g, '');
}

function fnv1a32(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Returns a deterministic, opaque dedupe key for a cloud entry.
 *
 * The key is suitable for use in a partial unique index:
 *   UNIQUE (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL
 */
export function buildDedupeKey(input: DedupeKeyInput): string {
  const titleNorm = normalizeForKey(input.title);
  const textNorm  = normalizeForKey(input.text);
  const content   = titleNorm || textNorm; // prefer title; fall back to text body

  const basis = [
    input.userId,
    input.type,
    content,
    input.date      ?? '',
    input.entryTime ?? '',
    input.amount != null ? String(input.amount) : '',
  ].join('|');

  return `dk:${fnv1a32(basis)}`;
}
