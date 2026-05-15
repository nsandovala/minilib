import { db } from '@/db';
import type { ParsedEntry, TimelineEntry, ShoppingMetadata } from '@/types';
import { createChecklistItems, softDeleteChecklistItemsForEntry } from '@/db/checklist';
import { processInput } from '@/core/agents/orchestrator';
import { buildEntryFingerprint } from '@/lib/sync/dedupe';
import { getActiveLocalUserId, recordBelongsToActiveUser, resolveOwnerUserId } from '@/lib/local-user';

/* ─── Safe UUID generator — polyfill for older browsers ──────────────────── */

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: RFC4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ─── Safe logging — only in development ─────────────────────────────────── */

function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[Liev]', ...args);
  }
}

function devError(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.error('[Liev]', ...args);
  }
}

type CreateEntryInput = Pick<TimelineEntry, 'text' | 'title' | 'type'> &
  Partial<Pick<TimelineEntry, 'date' | 'time' | 'tags' | 'done' | 'amount' | 'checklistItems' | 'listItems' | 'listGroups' | 'detectedTags' | 'metadata'>>;

export async function createEntry(data: CreateEntryInput): Promise<number> {
  try {
    const ownerUserId = resolveOwnerUserId();

    // Dedup: non-fatal — return existing id if identical entry created in the last 5 s
    try {
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const dup = await db.entries
        .where('createdAt').above(fiveSecondsAgo)
        .filter((e) => recordBelongsToActiveUser(e.ownerUserId) && e.type === data.type && e.text === data.text)
        .first();
      if (dup?.id !== undefined) return dup.id as number;
    } catch {
      // IDB index unavailable — skip dedup, proceed with insert
    }

    const existingEntries = await db.entries.toArray();
    const targetFingerprint = buildEntryFingerprint(ownerUserId ?? 'local', {
      type: data.type,
      title: data.title,
      text: data.text,
      date: data.date ?? null,
      amount: data.amount ?? null,
      createdAt: new Date(),
    });
    const semanticDup = existingEntries.find((entry) =>
      recordBelongsToActiveUser(entry.ownerUserId) &&
      buildEntryFingerprint(ownerUserId ?? 'local', entry) === targetFingerprint,
    );
    if (semanticDup?.id !== undefined) return semanticDup.id;

    const now = new Date();
    const localId = generateUUID();
    const payload = {
      localId,
      ownerUserId,
      text:     data.text,
      type:     data.type,
      title:    data.title,
      date:     data.date ?? null,
      time:     data.time ?? null,
      tags:     data.tags ?? [data.type],
      done:     data.done ?? false,
      amount:   data.amount ?? null,
      checklistItems: data.checklistItems ?? null,
      listItems: data.listItems ?? null,
      listGroups: data.listGroups ?? null,
      detectedTags: data.detectedTags ?? null,
      metadata: data.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      syncedAt:  null,
    };

    devLog('createEntry payload', payload);
    const id = await db.entries.add(payload);

    // Seed structured checklist items for shopping lists (backwards compat)
    if (data.type === 'shopping_list' && data.checklistItems?.length) {
      try {
        await createChecklistItems(localId, data.checklistItems);
      } catch (checklistErr) {
        devError('checklist seed failed', checklistErr);
        // non-blocking: main entry already saved
      }
    }

    return id as number;
  } catch (err) {
    devError('createEntry failed', err);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('liev:last-save-error', `${new Date().toISOString()} — ${String(err).slice(0, 120)}`);
      } catch { /* storage full or unavailable */ }
    }
    throw err;
  }
}

export async function addEntry(parsed: ParsedEntry): Promise<number> {
  return createEntry({
    text:   parsed.text,
    type:   parsed.type,
    title:  parsed.title,
    date:   parsed.date ?? null,
    time:   parsed.time ?? null,
    tags:   parsed.tags,
    amount: parsed.amount ?? null,
    checklistItems: parsed.checklistItems ?? null,
    listItems: parsed.listItems ?? null,
    listGroups: parsed.listGroups ?? null,
    detectedTags: parsed.detectedTags ?? null,
    metadata: parsed.metadata ?? null,
  });
}

export async function getEntries(): Promise<TimelineEntry[]> {
  const userId = getActiveLocalUserId();
  if (!userId) return [];

  const entries = await db.entries.orderBy('createdAt').reverse().toArray();
  return entries.filter((entry) => recordBelongsToActiveUser(entry.ownerUserId));
}

/* ─── Finance bridge: shopping list → payment ─────────────────────────────── */

async function ensureShoppingListPayment(entry: TimelineEntry): Promise<void> {
  const meta = entry.metadata as ShoppingMetadata | undefined;
  if (!meta || meta.listKind !== 'shopping') return;

  const total = meta.progress.totalChecked > 0
    ? meta.progress.totalChecked
    : meta.progress.totalEstimated;

  if (!total || total <= 0) return;

  // Dedup: look for existing payment tagged with this shopping list
  const allEntries = await db.entries.toArray();
  const existing = allEntries.find(
    (e) =>
      recordBelongsToActiveUser(e.ownerUserId) &&
      e.type === 'payment' &&
      e.tags.some((t) => t === `from_shopping:${entry.localId}`),
  );

  if (existing) return;

  await createEntry({
    text: `Compra ${meta.storeType}`,
    type: 'payment',
    title: `Compra ${meta.storeType}`,
    tags: ['payment', 'gasto cotidiano', `from_shopping:${entry.localId}`],
    amount: total,
  });
}

export async function toggleEntryDone(id: number, done: boolean): Promise<void> {
  const entry = await db.entries.get(id);
  if (!entry) return;

  await db.entries.update(id, { done, updatedAt: new Date(), syncedAt: null });

  if (done && entry.type === 'shopping_list') {
    await ensureShoppingListPayment(entry);
  }

  if (done && entry.type === 'payment') {
    const currentMeta = (entry.metadata as Record<string, unknown>) ?? {};
    await db.entries.update(id, {
      metadata: {
        ...currentMeta,
        estado: 'pagado',
        resolvedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
      syncedAt: null,
    });
  }

  if (!done && entry.type === 'payment') {
    const currentMeta = (entry.metadata as Record<string, unknown>) ?? {};
    await db.entries.update(id, {
      metadata: {
        ...currentMeta,
        estado: 'pendiente',
        resolvedAt: null,
      },
      updatedAt: new Date(),
      syncedAt: null,
    });
  }
}

export async function updateEntry(
  id: number,
  data: Partial<
    Pick<TimelineEntry, 'text' | 'title' | 'date' | 'time' | 'tags' | 'done' | 'type' | 'amount' | 'checklistItems' | 'listItems' | 'listGroups' | 'detectedTags' | 'metadata'>
  >
): Promise<void> {
  await db.entries.update(id, { ...data, updatedAt: new Date(), syncedAt: null });
}

export async function deleteEntry(id: number): Promise<void> {
  const entry = await db.entries.get(id);
  if (entry?.localId) {
    await softDeleteChecklistItemsForEntry(entry.localId);
  }
  await db.entries.delete(id);
}

/* ─── Shopping item toggle with total recalculation ───────────────────────── */

function recalcShoppingProgress(meta: ShoppingMetadata): ShoppingMetadata['progress'] {
  const total = meta.items.length;
  const checked = meta.items.filter((i) => i.checked).length;
  const totalEstimated = meta.items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const totalChecked = meta.items.filter((i) => i.checked).reduce((sum, i) => sum + (i.amount ?? 0), 0);
  return { total, checked, totalEstimated, totalChecked };
}

export async function toggleShoppingItem(entryId: number, itemId: string): Promise<void> {
  const entry = await db.entries.get(entryId);
  if (!entry) return;

  const meta = entry.metadata as ShoppingMetadata | undefined;
  if (!meta || meta.listKind !== 'shopping') return;

  const nextItems = meta.items.map((item) =>
    item.id === itemId ? { ...item, checked: !item.checked } : item,
  );

  const nextMetadata: ShoppingMetadata = {
    ...meta,
    items: nextItems,
    progress: recalcShoppingProgress({ ...meta, items: nextItems }),
  };

  await db.entries.update(entryId, {
    metadata: nextMetadata,
    updatedAt: new Date(),
    syncedAt: null,
  });
}

export async function reparseAndUpdateEntry(id: number, newText: string): Promise<void> {
  const existing = await db.entries.get(id);
  if (!existing) return;

  const result = processInput(newText.trim());
  if (!result.success || !result.entry) return;

  const parsed = result.entry;

  // Preserve checked state and amounts when re-parsing shopping lists by label
  let metadata = parsed.metadata ?? null;
  const existingMeta = existing.metadata as ShoppingMetadata | undefined;
  if (
    metadata &&
    (metadata as ShoppingMetadata).listKind === 'shopping' &&
    existingMeta?.listKind === 'shopping'
  ) {
    const existingByLabel = new Map<string, ShoppingMetadata['items'][number]>();
    for (const item of existingMeta.items) {
      existingByLabel.set(item.label.toLowerCase().trim(), item);
    }
    const nextItems = (metadata as ShoppingMetadata).items.map((item) => {
      const old = existingByLabel.get(item.label.toLowerCase().trim());
      return {
        ...item,
        checked: old?.checked ?? item.checked,
        amount: old?.amount ?? item.amount,
        quantity: old?.quantity ?? item.quantity,
        unit: old?.unit ?? item.unit,
      };
    });
    metadata = {
      ...(metadata as ShoppingMetadata),
      items: nextItems,
      progress: recalcShoppingProgress({ ...(metadata as ShoppingMetadata), items: nextItems }),
    };
  }

  await db.entries.update(id, {
    text: parsed.text,
    type: parsed.type,
    title: parsed.title,
    date: parsed.date ?? null,
    time: parsed.time ?? null,
    tags: parsed.tags,
    amount: parsed.amount ?? null,
    checklistItems: parsed.checklistItems ?? null,
    listItems: parsed.listItems ?? null,
    listGroups: parsed.listGroups ?? null,
    detectedTags: parsed.detectedTags ?? null,
    metadata,
    updatedAt: new Date(),
    syncedAt: null,
  });
}
