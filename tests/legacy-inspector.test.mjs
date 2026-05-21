import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLegacyDisplayIssues,
  getLegacyDisplayFlags,
} from '../src/core/display/legacy-inspector.ts';

let seq = 0;
function makeEntry(overrides = {}) {
  seq += 1;
  return {
    id: seq,
    localId: `li-${seq}`,
    type: 'note',
    title: '',
    text: '',
    date: null,
    time: null,
    tags: [],
    done: false,
    amount: null,
    metadata: null,
    createdAt: new Date('2026-05-20T10:00:00Z'),
    updatedAt: null,
    checklistItems: null,
    listItems: null,
    listGroups: null,
    detectedTags: null,
    ...overrides,
  };
}

// ─── SHOPPING_LIST_PET_CONTENT ─────────────────────────────────────────────────

test('shopping list with vet text is flagged as SHOPPING_LIST_PET_CONTENT', () => {
  const e = makeEntry({
    type: 'shopping_list',
    title: 'lista supermercado',
    text: 'comida veterinario arena del gato leche pan',
    metadata: { listKind: 'shopping', items: [] },
  });
  const issues = detectLegacyDisplayIssues(e);
  assert.ok(issues.some((i) => i.code === 'SHOPPING_LIST_PET_CONTENT'));
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isShoppingListWithPetContent, true);
  assert.equal(flags.resolvedPrimary, 'purchases');
});

test('shopping list without pet content has no SHOPPING_LIST_PET_CONTENT issue', () => {
  const e = makeEntry({
    type: 'shopping_list',
    title: 'mercado semanal',
    text: 'leche pan huevos arroz aceite',
    metadata: { listKind: 'shopping', items: [] },
  });
  const issues = detectLegacyDisplayIssues(e);
  assert.ok(!issues.some((i) => i.code === 'SHOPPING_LIST_PET_CONTENT'));
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isShoppingListWithPetContent, false);
});

// ─── PET_WITH_SHOPPING_STRUCTURE ──────────────────────────────────────────────

test('pet entry with shopping metadata is flagged as PET_WITH_SHOPPING_STRUCTURE', () => {
  const e = makeEntry({
    type: 'pet',
    title: 'lista cosas mascota',
    text: 'arena comida correa',
    metadata: { listKind: 'shopping', items: [{ name: 'arena', checked: false, price: null }] },
  });
  const issues = detectLegacyDisplayIssues(e);
  assert.ok(issues.some((i) => i.code === 'PET_WITH_SHOPPING_STRUCTURE'));
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isPetWithShoppingStructure, true);
});

test('short pet entry without shopping structure is clean', () => {
  const e = makeEntry({
    type: 'pet',
    title: 'Saly veterinario viernes',
    text: 'Saly veterinario viernes 17:30',
    date: '2026-05-24',
  });
  const issues = detectLegacyDisplayIssues(e);
  assert.ok(!issues.some((i) => i.code === 'PET_WITH_SHOPPING_STRUCTURE'));
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isPetWithShoppingStructure, false);
  assert.equal(flags.resolvedPrimary, 'pets');
});

// ─── PAYMENT_WITHOUT_AMOUNT ───────────────────────────────────────────────────

test('payment entry without amount is flagged as PAYMENT_WITHOUT_AMOUNT', () => {
  const e = makeEntry({
    type: 'payment',
    title: 'pagar internet',
    text: 'pagar internet viernes',
    amount: null,
  });
  const issues = detectLegacyDisplayIssues(e);
  assert.ok(issues.some((i) => i.code === 'PAYMENT_WITHOUT_AMOUNT'));
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isPaymentWithoutAmount, true);
  assert.equal(flags.resolvedPrimary, 'notes');
});

test('payment entry with valid amount is clean', () => {
  const e = makeEntry({
    type: 'payment',
    title: 'pagar internet',
    text: 'pagar internet 29990',
    amount: 29990,
  });
  const issues = detectLegacyDisplayIssues(e);
  assert.ok(!issues.some((i) => i.code === 'PAYMENT_WITHOUT_AMOUNT'));
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isPaymentWithoutAmount, false);
  assert.equal(flags.resolvedPrimary, 'payments');
});

// ─── LONG_FORM_WRONG_TYPE ─────────────────────────────────────────────────────

test('long-form doc with type=pet is flagged as LONG_FORM_WRONG_TYPE', () => {
  const e = makeEntry({
    type: 'pet',
    title: 'Investigación mascotas',
    text: [
      'Investigación sobre el módulo de mascotas en la plataforma.',
      '1. Primera sección sobre registro de mascotas en el sistema.',
      '2. Segunda sección sobre citas veterinarias y vacunas programadas.',
      '3. Tercera sección sobre alimentación y cuidado en detalle completo.',
    ].join('\n'),
  });
  const issues = detectLegacyDisplayIssues(e);
  assert.ok(issues.some((i) => i.code === 'LONG_FORM_WRONG_TYPE'), JSON.stringify(issues));
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isLongFormWithWrongType, true);
  assert.equal(flags.resolvedPrimary, 'notes');
});

test('short pet entry is not flagged as long-form wrong type', () => {
  const e = makeEntry({
    type: 'pet',
    title: 'Saly control',
    text: 'Saly control médico martes',
  });
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isLongFormWithWrongType, false);
});

// ─── COMPLETED_IN_NON_PRIMARY ─────────────────────────────────────────────────

test('completed pet entry is flagged as COMPLETED_IN_NON_PRIMARY', () => {
  const e = makeEntry({
    type: 'pet',
    title: 'Saly veterinario',
    text: 'Saly veterinario viernes',
    done: true,
  });
  const issues = detectLegacyDisplayIssues(e);
  assert.ok(issues.some((i) => i.code === 'COMPLETED_IN_NON_PRIMARY'));
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isCompletedInNonPrimarySurface, true);
});

test('completed note entry is not flagged as COMPLETED_IN_NON_PRIMARY', () => {
  const e = makeEntry({
    type: 'note',
    title: 'nota completada',
    text: 'esto es solo una nota',
    done: true,
  });
  const flags = getLegacyDisplayFlags(e);
  assert.equal(flags.isCompletedInNonPrimarySurface, false);
  assert.equal(flags.resolvedPrimary, 'notes');
});

test('clean short note entry has no issues', () => {
  const e = makeEntry({
    type: 'note',
    title: 'recordar llamar al banco',
    text: 'recordar llamar al banco el lunes',
  });
  const issues = detectLegacyDisplayIssues(e);
  assert.equal(issues.length, 0, `expected no issues, got: ${JSON.stringify(issues)}`);
});
