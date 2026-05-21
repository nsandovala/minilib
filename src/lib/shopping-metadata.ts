import type { ShoppingItem, ShoppingMetadata, TimelineEntry } from '@/types';

export function getShoppingMetadata(entry: TimelineEntry): ShoppingMetadata | null {
  const candidate = entry.metadata as ShoppingMetadata | null | undefined;
  if (!candidate || typeof candidate !== 'object') return null;
  if (candidate.listKind !== 'shopping') return null;
  return candidate;
}

export function getSafeShoppingItems(entry: TimelineEntry): ShoppingItem[] {
  const metadata = getShoppingMetadata(entry);
  return Array.isArray(metadata?.items) ? metadata.items : [];
}
