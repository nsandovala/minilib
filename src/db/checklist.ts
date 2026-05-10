import { db } from '@/db';
import type { ChecklistItem } from '@/types';

export async function getChecklistItemsForEntry(localEntryId: string): Promise<ChecklistItem[]> {
  return db.checklist_items
    .where('localEntryId')
    .equals(localEntryId)
    .filter((item) => !item.deletedAt)
    .sortBy('sortOrder');
}

export async function createChecklistItems(
  localEntryId: string,
  labels: string[],
  category: string | null = null,
): Promise<void> {
  if (!labels.length) return;
  const now = new Date();
  const items: Array<Omit<ChecklistItem, 'id'>> = labels.map((label, index) => ({
    localId: crypto.randomUUID(),
    localEntryId,
    label,
    checked: false,
    category,
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
    deletedAt: null,
  }));
  await db.checklist_items.bulkAdd(items as ChecklistItem[]);
}

export async function toggleChecklistItem(id: number, checked: boolean): Promise<void> {
  await db.checklist_items.update(id, {
    checked,
    updatedAt: new Date(),
    syncedAt: null,
  });
}

export async function softDeleteChecklistItemsForEntry(localEntryId: string): Promise<void> {
  const now = new Date();
  const items = await db.checklist_items
    .where('localEntryId')
    .equals(localEntryId)
    .toArray();

  await Promise.all(
    items
      .filter((item) => !item.deletedAt)
      .map((item) =>
        item.id !== undefined
          ? db.checklist_items.update(item.id, { deletedAt: now, updatedAt: now, syncedAt: null })
          : Promise.resolve(),
      ),
  );
}

export async function upsertChecklistItemFromSync(
  item: Omit<ChecklistItem, 'id'>,
): Promise<void> {
  const existing = await db.checklist_items.where('localId').equals(item.localId).first();

  if (!existing) {
    await db.checklist_items.add(item as ChecklistItem);
    return;
  }

  const localUpdated = existing.updatedAt ?? existing.createdAt;
  if (item.updatedAt > localUpdated) {
    await db.checklist_items.update(existing.id!, {
      label:     item.label,
      checked:   item.checked,
      category:  item.category,
      sortOrder: item.sortOrder,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt ?? null,
      syncedAt:  new Date(),
    });
  }
}
