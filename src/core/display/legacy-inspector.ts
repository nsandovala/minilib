import type { TimelineEntry } from '@/types';
import {
  getPrimarySurface,
  isLongFormNote,
  hasCalendarMetadata,
} from './surface-resolver.ts';
import type { Surface } from './surface-resolver.ts';

export interface LegacyDisplayIssue {
  code: string;
  description: string;
  suggestedSurface?: Surface;
}

export interface LegacyDisplayFlags {
  isShoppingListWithPetContent: boolean;
  isPetWithShoppingStructure: boolean;
  isPaymentWithoutAmount: boolean;
  isLongFormWithWrongType: boolean;
  isCompletedInNonPrimarySurface: boolean;
  resolvedPrimary: Surface;
}

function hasShoppingStructure(entry: TimelineEntry): boolean {
  const m = entry.metadata as { listKind?: string; items?: unknown } | null | undefined;
  if (m?.listKind === 'shopping') return true;
  if (entry.type === 'shopping_list') return true;
  if (Array.isArray(m?.items) && (m.items as unknown[]).length > 0) return true;
  return false;
}

function hasPetContent(entry: TimelineEntry): boolean {
  const combined = `${entry.title} ${entry.text}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return /\b(veterinario|veterinaria|vacuna|pastilla|desparasitar|mascota|perro|gato|arena del|comida para|alimento para)\b/.test(combined);
}

export function detectLegacyDisplayIssues(entry: TimelineEntry): LegacyDisplayIssue[] {
  const issues: LegacyDisplayIssue[] = [];
  const primary = getPrimarySurface(entry);

  if (entry.type === 'shopping_list' && hasPetContent(entry)) {
    issues.push({
      code: 'SHOPPING_LIST_PET_CONTENT',
      description: 'Shopping list contains pet-related keywords — must stay in purchases, not pets',
      suggestedSurface: 'purchases',
    });
  }

  if (entry.type === 'pet' && hasShoppingStructure(entry)) {
    issues.push({
      code: 'PET_WITH_SHOPPING_STRUCTURE',
      description: 'Entry typed as pet but has shopping list structure — should be purchases',
      suggestedSurface: 'purchases',
    });
  }

  if (entry.type === 'payment' && (entry.amount === null || entry.amount === undefined)) {
    issues.push({
      code: 'PAYMENT_WITHOUT_AMOUNT',
      description: 'Entry typed as payment but has no numeric amount — resolves to notes',
      suggestedSurface: 'notes',
    });
  }

  if (isLongFormNote(entry) && !hasCalendarMetadata(entry)) {
    const typeExpectsCategory = ['pet', 'payment', 'shopping_list', 'health', 'appointment', 'task'].includes(entry.type);
    if (typeExpectsCategory && primary === 'notes') {
      issues.push({
        code: 'LONG_FORM_WRONG_TYPE',
        description: `Entry has type="${entry.type}" but is a long-form document — display layer routes to notes`,
        suggestedSurface: 'notes',
      });
    }
  }

  if (entry.done && primary !== 'notes' && primary !== 'home' && primary !== 'todos') {
    issues.push({
      code: 'COMPLETED_IN_NON_PRIMARY',
      description: `Entry is marked done but primary surface is "${primary}" — may appear unexpectedly`,
      suggestedSurface: primary,
    });
  }

  return issues;
}

export function getLegacyDisplayFlags(entry: TimelineEntry): LegacyDisplayFlags {
  return {
    isShoppingListWithPetContent: entry.type === 'shopping_list' && hasPetContent(entry),
    isPetWithShoppingStructure: entry.type === 'pet' && hasShoppingStructure(entry),
    isPaymentWithoutAmount: entry.type === 'payment' && (entry.amount === null || entry.amount === undefined),
    isLongFormWithWrongType: isLongFormNote(entry) && !hasCalendarMetadata(entry) &&
      ['pet', 'payment', 'shopping_list', 'health', 'appointment', 'task'].includes(entry.type) &&
      getPrimarySurface(entry) === 'notes',
    isCompletedInNonPrimarySurface: (() => {
      const p = getPrimarySurface(entry);
      return !!entry.done && p !== 'notes' && p !== 'home' && p !== 'todos';
    })(),
    resolvedPrimary: getPrimarySurface(entry),
  };
}
