export type ListEntryType = 'shopping_list' | 'health' | 'pet';

export function hasExplicitListIntent(text: string): boolean {
  return /\blista\b/i.test(text) || /[,;/]/.test(text) || /\n/.test(text) || /\s+y\s+/i.test(text);
}

export function shouldBuildShoppingList(params: {
  itemCount: number;
  explicitListIntent: boolean;
  hasStoreKeyword: boolean;
  hasKnownCategory: boolean;
}): boolean {
  const { itemCount, explicitListIntent, hasStoreKeyword, hasKnownCategory } = params;
  if (itemCount < 1) return false;
  if (itemCount < 2 && !explicitListIntent) return false;
  if (itemCount < 2 && !hasStoreKeyword && !hasKnownCategory) return false;
  return true;
}

export function resolveListEntryType(detectedTags: string[]): ListEntryType {
  if (detectedTags.includes('mascotas')) return 'pet';
  if (detectedTags.includes('farmacia')) return 'health';
  return 'shopping_list';
}
