import test from 'node:test';
import assert from 'node:assert/strict';
import { getSafeShoppingItems, getShoppingMetadata } from '../src/lib/shopping-metadata.ts';

let seq = 0;

function makeEntry(overrides = {}) {
  seq += 1;
  return {
    id: seq,
    localId: `shopping-${seq}`,
    type: 'shopping_list',
    title: 'Lista',
    text: 'Lista',
    date: null,
    time: null,
    tags: ['shopping'],
    done: false,
    amount: null,
    metadata: null,
    createdAt: new Date('2026-05-20T10:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

test('getSafeShoppingItems devuelve items válidos cuando metadata.items es array', () => {
  const entry = makeEntry({
    metadata: {
      listKind: 'shopping',
      storeType: 'supermercado',
      items: [{ id: '1', label: 'Pan', category: 'abarrotes', checked: false }],
      progress: { total: 1, checked: 0, totalEstimated: 0, totalChecked: 0 },
    },
  });

  assert.deepEqual(getSafeShoppingItems(entry), [
    { id: '1', label: 'Pan', category: 'abarrotes', checked: false },
  ]);
});

test('getSafeShoppingItems devuelve array vacío cuando metadata.items es undefined', () => {
  const entry = makeEntry({
    metadata: {
      listKind: 'shopping',
      storeType: 'supermercado',
      progress: { total: 0, checked: 0, totalEstimated: 0, totalChecked: 0 },
    },
  });

  assert.deepEqual(getSafeShoppingItems(entry), []);
});

test('getSafeShoppingItems devuelve array vacío cuando metadata.items es null', () => {
  const entry = makeEntry({
    metadata: {
      listKind: 'shopping',
      storeType: 'supermercado',
      items: null,
      progress: { total: 0, checked: 0, totalEstimated: 0, totalChecked: 0 },
    },
  });

  assert.deepEqual(getSafeShoppingItems(entry), []);
});

test('getSafeShoppingItems devuelve array vacío con metadata malformada', () => {
  const entry = makeEntry({
    metadata: {
      listKind: 'shopping',
      storeType: 'supermercado',
      items: { id: '1', label: 'Pan' },
      progress: { total: 0, checked: 0, totalEstimated: 0, totalChecked: 0 },
    },
  });

  assert.deepEqual(getSafeShoppingItems(entry), []);
});

test('getShoppingMetadata ignora metadata que no es lista de compras', () => {
  const entry = makeEntry({
    type: 'note',
    metadata: {
      calendar: {
        kind: 'single_event',
        events: [],
      },
    },
  });

  assert.equal(getShoppingMetadata(entry), null);
  assert.deepEqual(getSafeShoppingItems(entry), []);
});
