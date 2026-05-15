import type { ChecklistItem, TimelineEntry } from '@/types';
import type { EntryPayload, ChecklistItemPayload } from './types';

type EntryFingerprintInput = Pick<
  TimelineEntry,
  'title' | 'text' | 'date' | 'amount'
> & { type: string; createdAt: Date | string };

type ChecklistFingerprintInput = Pick<
  ChecklistItem,
  'localEntryId' | 'label' | 'sortOrder'
> & { createdAt: Date | string };

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function toBucketedMinute(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'invalid-date';
  const bucketMs = 5 * 60 * 1000;
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs).toISOString();
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildEntryFingerprint(
  userId: string,
  entry: EntryFingerprintInput,
): string {
  const title = normalizeText(entry.title);
  const text = normalizeText(entry.text);
  const basis = [
    userId,
    entry.type,
    title || text,
    entry.date ?? '',
    entry.amount ?? '',
    toBucketedMinute(entry.createdAt),
  ].join('|');

  return `entry:${hashString(basis)}`;
}

export function buildChecklistFingerprint(
  userId: string,
  item: ChecklistFingerprintInput,
): string {
  const basis = [
    userId,
    item.localEntryId,
    normalizeText(item.label),
    item.sortOrder ?? 0,
    toBucketedMinute(item.createdAt),
  ].join('|');

  return `item:${hashString(basis)}`;
}

export function dedupeEntryPayloads(
  userId: string,
  payloads: EntryPayload[],
): EntryPayload[] {
  const winners: EntryPayload[] = [];

  for (const payload of payloads) {
    const fingerprint = buildEntryFingerprint(userId, {
      type: payload.type,
      title: payload.title,
      text: payload.text,
      date: payload.date,
      amount: payload.amount,
      createdAt: payload.createdAt,
    });
    const existingIndex = winners.findIndex((candidate) =>
      candidate.localId === payload.localId ||
      buildEntryFingerprint(userId, {
        type: candidate.type,
        title: candidate.title,
        text: candidate.text,
        date: candidate.date,
        amount: candidate.amount,
        createdAt: candidate.createdAt,
      }) === fingerprint,
    );

    if (existingIndex === -1) {
      winners.push(payload);
      continue;
    }

    const current = winners[existingIndex]!;
    if (new Date(payload.updatedAt) >= new Date(current.updatedAt)) {
      winners[existingIndex] = payload;
    }
  }

  return winners;
}

export function dedupeChecklistPayloads(
  userId: string,
  payloads: ChecklistItemPayload[],
): ChecklistItemPayload[] {
  const winners: ChecklistItemPayload[] = [];

  for (const payload of payloads) {
    const fingerprint = buildChecklistFingerprint(userId, {
      localEntryId: payload.localEntryId,
      label: payload.label,
      sortOrder: payload.sortOrder,
      createdAt: payload.createdAt,
    });
    const existingIndex = winners.findIndex((candidate) =>
      candidate.localId === payload.localId ||
      buildChecklistFingerprint(userId, {
        localEntryId: candidate.localEntryId,
        label: candidate.label,
        sortOrder: candidate.sortOrder,
        createdAt: candidate.createdAt,
      }) === fingerprint,
    );

    if (existingIndex === -1) {
      winners.push(payload);
      continue;
    }

    const current = winners[existingIndex]!;
    if (new Date(payload.updatedAt) >= new Date(current.updatedAt)) {
      winners[existingIndex] = payload;
    }
  }

  return winners;
}
