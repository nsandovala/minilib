import { auth } from '@clerk/nextjs/server';
import {
  getChecklistItemsForUser,
  getEntriesForUser,
  upsertChecklistItems,
  upsertEntries,
} from '@/db/cloud/queries';
import type { EntryPayload, ChecklistItemPayload } from '@/lib/sync/types';
import type { CloudEntryInsert, CloudChecklistItemInsert } from '@/db/cloud/schema';
import {
  buildChecklistFingerprint,
  buildEntryFingerprint,
  dedupeChecklistPayloads,
  dedupeEntryPayloads,
} from '@/lib/sync/dedupe';
import { extractLocalId, scopeCloudId } from '@/db/cloud/identity';
import { buildDedupeKey } from '@/lib/sync/dedupe-key';

export const dynamic = 'force-dynamic';

function entryToInsert(
  userId: string,
  cloudId: string,
  payload: EntryPayload,
  dedupeKey: string,         // always computed server-side, never trusted from client
): CloudEntryInsert {
  return {
    id:        cloudId,
    userId,
    text:      payload.text,
    type:      payload.type,
    title:     payload.title,
    date:      payload.date ?? null,
    entryTime: payload.entryTime ?? null,
    tags:      JSON.stringify(payload.tags),
    done:      payload.done,
    amount:    payload.amount ?? null,
    metadata:  payload.metadata ?? null,
    dedupeKey,
    createdAt: new Date(payload.createdAt),
    updatedAt: new Date(payload.updatedAt),
    deletedAt: null,
  };
}

function checklistItemToInsert(
  userId: string,
  cloudId: string,
  scopedEntryId: string,
  payload: ChecklistItemPayload,
): CloudChecklistItemInsert {
  return {
    id:        cloudId,
    entryId:   scopedEntryId,
    userId,
    label:     payload.label,
    checked:   payload.checked,
    category:  payload.category ?? null,
    sortOrder: payload.sortOrder ?? 0,
    createdAt: new Date(payload.createdAt),
    updatedAt: new Date(payload.updatedAt),
    deletedAt: payload.deletedAt ? new Date(payload.deletedAt) : null,
  };
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    if (process.env.NODE_ENV !== 'production') console.warn('[push] 401 — no userId from Clerk');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { entries: EntryPayload[]; checklistItems?: ChecklistItemPayload[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.entries)) {
    return Response.json({ error: 'entries must be an array' }, { status: 400 });
  }

  try {
    const [existingEntries, existingItems] = await Promise.all([
      getEntriesForUser(userId),
      getChecklistItemsForUser(userId),
    ]);

    const dedupedEntries = dedupeEntryPayloads(userId, body.entries);
    const dedupedItems = dedupeChecklistPayloads(userId, body.checklistItems ?? []);

    const existingEntryByLocalId    = new Map<string, string>();
    const existingEntryByDedupeKey  = new Map<string, string>(); // stable key → cloud id
    const existingEntryByFingerprint = new Map<string, string>();
    for (const row of existingEntries) {
      const localId = extractLocalId(userId, row.id);
      existingEntryByLocalId.set(localId, row.id);
      if (row.dedupeKey) {
        existingEntryByDedupeKey.set(row.dedupeKey, row.id);
      }
      existingEntryByFingerprint.set(buildEntryFingerprint(userId, {
        type: row.type,
        title: row.title,
        text: row.text,
        date: row.date,
        amount: row.amount,
        createdAt: row.createdAt,
      }), row.id);
    }

    const canonicalEntryIdByIncomingLocalId = new Map<string, string>();
    const entryRows = dedupedEntries.map((payload) => {
      // dedupe_key is always computed server-side from Clerk userId — never from client payload
      const dedupeKey = buildDedupeKey({
        userId,
        type:      payload.type,
        title:     payload.title,
        text:      payload.text,
        date:      payload.date ?? null,
        entryTime: payload.entryTime ?? null,
        amount:    payload.amount ?? null,
      });

      const fingerprint = buildEntryFingerprint(userId, {
        type: payload.type,
        title: payload.title,
        text: payload.text,
        date: payload.date,
        amount: payload.amount,
        createdAt: payload.createdAt,
      });

      // Resolution order: exact id match → stable dedupe_key → time-bucketed fingerprint → new row
      const canonicalCloudId =
        existingEntryByLocalId.get(payload.localId) ??
        existingEntryByDedupeKey.get(dedupeKey) ??
        existingEntryByFingerprint.get(fingerprint) ??
        scopeCloudId(userId, payload.localId);

      canonicalEntryIdByIncomingLocalId.set(payload.localId, canonicalCloudId);
      existingEntryByLocalId.set(payload.localId, canonicalCloudId);
      existingEntryByDedupeKey.set(dedupeKey, canonicalCloudId);
      existingEntryByFingerprint.set(fingerprint, canonicalCloudId);

      return entryToInsert(userId, canonicalCloudId, payload, dedupeKey);
    });

    const existingItemByLocalId = new Map<string, string>();
    const existingItemByFingerprint = new Map<string, string>();
    for (const row of existingItems) {
      const localId = extractLocalId(userId, row.id);
      const localEntryId = extractLocalId(userId, row.entryId);
      existingItemByLocalId.set(localId, row.id);
      existingItemByFingerprint.set(buildChecklistFingerprint(userId, {
        localEntryId,
        label: row.label,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
      }), row.id);
    }

    const itemRows = dedupedItems.map((payload) => {
      const canonicalEntryCloudId =
        canonicalEntryIdByIncomingLocalId.get(payload.localEntryId) ??
        scopeCloudId(userId, payload.localEntryId);
      const canonicalEntryLocalId = extractLocalId(userId, canonicalEntryCloudId);
      const fingerprint = buildChecklistFingerprint(userId, {
        localEntryId: canonicalEntryLocalId,
        label: payload.label,
        sortOrder: payload.sortOrder,
        createdAt: payload.createdAt,
      });
      const canonicalCloudId =
        existingItemByLocalId.get(payload.localId) ??
        existingItemByFingerprint.get(fingerprint) ??
        scopeCloudId(userId, payload.localId);

      existingItemByLocalId.set(payload.localId, canonicalCloudId);
      existingItemByFingerprint.set(fingerprint, canonicalCloudId);

      return checklistItemToInsert(userId, canonicalCloudId, canonicalEntryCloudId, {
        ...payload,
        localEntryId: canonicalEntryLocalId,
      });
    });

    await Promise.all([
      upsertEntries(entryRows),
      upsertChecklistItems(itemRows),
    ]);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[push] 200 — user:${userId.slice(0, 8)} entries:${entryRows.length} items:${itemRows.length}`);
    }

    return Response.json({ ok: true, entries: entryRows.length, checklistItems: itemRows.length });
  } catch (err) {
    console.error('[push] 500 —', err instanceof Error ? err.message : 'unknown error');
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
