import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasExplicitListIntent,
  resolveListEntryType,
  shouldBuildShoppingList,
} from '../src/core/agents/parser-rules.ts';
import {
  buildEntryFingerprint,
  dedupeEntryPayloads,
} from '../src/lib/sync/dedupe.ts';

test('comprar pan no se trata como lista completa', () => {
  assert.equal(hasExplicitListIntent('comprar pan'), false);
  assert.equal(shouldBuildShoppingList({
    itemCount: 1,
    explicitListIntent: false,
    hasStoreKeyword: false,
    hasKnownCategory: true,
  }), false);
});

test('lista de supermercado con multiples items se trata como lista', () => {
  assert.equal(hasExplicitListIntent('lista de supermercado: leche, huevos, arroz'), true);
  assert.equal(shouldBuildShoppingList({
    itemCount: 3,
    explicitListIntent: true,
    hasStoreKeyword: true,
    hasKnownCategory: true,
  }), true);
});

test('farmacia y mascota dominan el tipo de lista', () => {
  assert.equal(resolveListEntryType(['farmacia']), 'health');
  assert.equal(resolveListEntryType(['mascotas']), 'pet');
  assert.equal(resolveListEntryType(['despensa']), 'shopping_list');
});

test('fingerprint estable para entradas semanticamente iguales', () => {
  const first = buildEntryFingerprint('user_123', {
    type: 'shopping_list',
    title: 'Lista de compras',
    text: 'lista de compras: leche, huevos',
    date: '2026-05-15',
    amount: 5000,
    createdAt: '2026-05-15T10:02:11.000Z',
  });

  const second = buildEntryFingerprint('user_123', {
    type: 'shopping_list',
    title: 'Lista   de compras',
    text: 'Lista de compras: leche, huevos',
    date: '2026-05-15',
    amount: 5000,
    createdAt: '2026-05-15T10:04:55.000Z',
  });

  assert.equal(first, second);
});

test('dedupeEntryPayloads conserva solo la version mas nueva', () => {
  const deduped = dedupeEntryPayloads('user_123', [
    {
      localId: 'entry-a',
      text: 'lista de supermercado: leche, huevos',
      type: 'shopping_list',
      title: 'Lista de compras',
      date: '2026-05-15',
      entryTime: null,
      tags: ['shopping_list'],
      done: false,
      amount: 4500,
      metadata: null,
      createdAt: '2026-05-15T10:02:11.000Z',
      updatedAt: '2026-05-15T10:02:11.000Z',
    },
    {
      localId: 'entry-b',
      text: 'lista de supermercado: leche, huevos',
      type: 'shopping_list',
      title: 'Lista de compras',
      date: '2026-05-15',
      entryTime: null,
      tags: ['shopping_list'],
      done: true,
      amount: 4500,
      metadata: null,
      createdAt: '2026-05-15T10:03:12.000Z',
      updatedAt: '2026-05-15T10:05:12.000Z',
    },
  ]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.localId, 'entry-b');
  assert.equal(deduped[0]?.done, true);
});
