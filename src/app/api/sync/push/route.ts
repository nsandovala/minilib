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

function dedupeRowsById<T extends { id: string }>(rows: T[]): { rows: T[]; removed: number } {
  const byId = new Map<string, T>();
  for (const row of rows) byId.set(row.id, row);
  return { rows: Array.from(byId.values()), removed: rows.length - byId.size };
}

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
    deletedAt: payload.deletedAt ? new Date(payload.deletedAt) : null,
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

    // seenDedupeKeyToCloudId: tracks dedupe keys assigned within this request's batch.
    // If two payload entries share the same dedupe_key, the second resolves to the first's
    // cloud ID — preventing the batch from sending two rows with the same (user_id, dedupe_key)
    // to upsertEntries, which would violate entries_user_dedupe_key_active_idx on the UPDATE
    // phase with no ON CONFLICT handler to catch the partial-index violation.
    const seenDedupeKeyToCloudId = new Map<string, string>();

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

      // Resolution order:
      // 1. within-batch dedup key  — two entries with same dedupe_key in this push → merge
      // 2. exact local id match    — same device, same entry (normal update)
      // 3. DB-level dedup key      — cross-device / cross-session semantic duplicate
      // 4. time-bucketed fingerprint
      // 5. new scoped id
      const canonicalCloudId =
        seenDedupeKeyToCloudId.get(dedupeKey) ??
        existingEntryByLocalId.get(payload.localId) ??
        existingEntryByDedupeKey.get(dedupeKey) ??
        existingEntryByFingerprint.get(fingerprint) ??
        scopeCloudId(userId, payload.localId);

      seenDedupeKeyToCloudId.set(dedupeKey, canonicalCloudId);
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

    const dedupedEntryRowsById = dedupeRowsById(entryRows);
    const dedupedItemRowsById  = dedupeRowsById(itemRows);

    if (process.env.NODE_ENV !== 'production') {
      if (dedupedEntryRowsById.removed > 0 || dedupedItemRowsById.removed > 0) {
        console.warn('[push] deduped final rows by id', {
          entryRowsBefore:    entryRows.length,
          entryRowsAfter:     dedupedEntryRowsById.rows.length,
          entryRowsRemoved:   dedupedEntryRowsById.removed,
          itemRowsBefore:     itemRows.length,
          itemRowsAfter:      dedupedItemRowsById.rows.length,
          itemRowsRemoved:    dedupedItemRowsById.removed,
        });
      }
    }

    await Promise.all([
      upsertEntries(dedupedEntryRowsById.rows).catch((e: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          const err = e as Record<string, unknown>;
          const rawMessage = String(err?.message ?? '');
          console.error('[push] upsertEntries failed', {
            name: err?.name,
            messageHead: rawMessage.slice(0, 800),
            messageTail: rawMessage.slice(-1600),
            messageLength: rawMessage.length,
            code: err?.code,
            constraint: err?.constraint,
            detail: err?.detail,
            routine: err?.routine,
            cause: err?.cause instanceof Error
              ? { name: (err.cause as Error).name, message: (err.cause as Error).message }
              : undefined,
          });
        }
        throw e;
      }),
      upsertChecklistItems(dedupedItemRowsById.rows).catch((e: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          const err = e as Record<string, unknown>;
          const rawMessage = String(err?.message ?? '');
          console.error('[push] upsertChecklistItems failed', {
            name: err?.name,
            messageHead: rawMessage.slice(0, 800),
            messageTail: rawMessage.slice(-1600),
            messageLength: rawMessage.length,
            code: err?.code,
            constraint: err?.constraint,
            detail: err?.detail,
            routine: err?.routine,
            cause: err?.cause instanceof Error
              ? { name: (err.cause as Error).name, message: (err.cause as Error).message }
              : undefined,
          });
        }
        throw e;
      }),
    ]);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[push] 200 — user:${userId.slice(0, 8)} entries:${dedupedEntryRowsById.rows.length} items:${dedupedItemRowsById.rows.length}`);
    }

    return Response.json({
      ok: true,
      entries: dedupedEntryRowsById.rows.length,
      checklistItems: dedupedItemRowsById.rows.length,
      ...(process.env.NODE_ENV !== 'production'
        ? { deduped: { entriesRemoved: dedupedEntryRowsById.removed, checklistItemsRemoved: dedupedItemRowsById.removed } }
        : {}),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      const e = err as Record<string, unknown>;
      const rawMessage = String(e?.message ?? '');
      console.error('[push] 500 —', {
        name: e?.name,
        messageHead: rawMessage.slice(0, 800),
        messageTail: rawMessage.slice(-1600),
        messageLength: rawMessage.length,
        code: e?.code,
        constraint: e?.constraint,
        detail: e?.detail,
        routine: e?.routine,
        cause: e?.cause instanceof Error
          ? { name: (e.cause as Error).name, message: (e.cause as Error).message }
          : undefined,
      });
    } else {
      console.error('[push] 500 —', err instanceof Error ? err.message : 'unknown error');
    }
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
