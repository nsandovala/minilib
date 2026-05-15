import { db } from '@/db';
import {
  getLegacyLocalOwnerUserId,
  setLegacyLocalOwnerUserId,
} from '@/lib/local-user';

export async function claimLegacyRecordsForUser(userId: string): Promise<void> {
  const claimedOwner = getLegacyLocalOwnerUserId();
  if (claimedOwner && claimedOwner !== userId) {
    return;
  }

  const [orphanEntries, orphanItems, ownedEntries, ownedItems] = await Promise.all([
    db.entries.filter((entry) => !entry.ownerUserId).toArray(),
    db.checklist_items.filter((item) => !item.ownerUserId).toArray(),
    db.entries.filter((entry) => entry.ownerUserId === userId).count(),
    db.checklist_items.filter((item) => item.ownerUserId === userId).count(),
  ]);

  if (!orphanEntries.length && !orphanItems.length) {
    if (!claimedOwner && (ownedEntries > 0 || ownedItems > 0)) {
      setLegacyLocalOwnerUserId(userId);
    }
    return;
  }

  if (!claimedOwner && ownedEntries === 0 && ownedItems === 0) {
    setLegacyLocalOwnerUserId(userId);
  }

  if (getLegacyLocalOwnerUserId() !== userId) {
    return;
  }

  await Promise.all([
    ...orphanEntries.map((entry) =>
      entry.id !== undefined
        ? db.entries.update(entry.id, { ownerUserId: userId })
        : Promise.resolve(),
    ),
    ...orphanItems.map((item) =>
      item.id !== undefined
        ? db.checklist_items.update(item.id, { ownerUserId: userId })
        : Promise.resolve(),
    ),
  ]);
}
