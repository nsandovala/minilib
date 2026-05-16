import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasExplicitListIntent,
  resolveListEntryType,
  shouldBuildShoppingList,
  isLongFormNote,
  hasPetAction,
  hasShoppingIntent,
  hasPaymentIntent,
} from '../src/core/agents/parser-rules.ts';
import {
  buildEntryFingerprint,
  dedupeEntryPayloads,
} from '../src/lib/sync/dedupe.ts';

// ─── Existing tests (preserved) ─────────────────────────────────────────────

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

// ─── Guard functions ─────────────────────────────────────────────────────────

test('isLongFormNote: detecta texto largo y estructurado', () => {
  assert.equal(isLongFormNote('x'.repeat(501)), true, 'más de 500 chars');
  assert.equal(isLongFormNote('llevar al vet mañana'), false, 'texto corto');
  assert.equal(isLongFormNote('# Título\nContenido de la sección'), true, 'markdown heading');
  assert.equal(isLongFormNote('1. Primero\n2. Segundo\n3. Tercero'), true, 'secciones numeradas');
});

test('hasPetAction: requiere acción concreta, no solo la palabra mascotas', () => {
  assert.equal(hasPetAction('llevar al veterinario'), true, 'veterinario');
  assert.equal(hasPetAction('vacuna para el perro'), true, 'vacuna + perro');
  assert.equal(hasPetAction('llevar a Saly al veterinario el viernes'), true, 'vet con nombre');
  assert.equal(hasPetAction('comida para el perro'), true, 'comida + perro');
  assert.equal(hasPetAction('arena para el gato'), true, 'arena + gato');
  assert.equal(hasPetAction('sección de mascotas del app'), false, 'mascotas como categoría');
  assert.equal(hasPetAction('investigación sobre mascotas'), false, 'investigación abstracta');
  assert.equal(hasPetAction('busca si hay algo relacionado con mascotas'), false, 'busca conceptual');
  assert.equal(hasPetAction('módulo mascotas en la app'), false, 'módulo mascotas');
});

test('hasShoppingIntent: detecta intención de compra', () => {
  assert.equal(hasShoppingIntent('comprar leche'), true);
  assert.equal(hasShoppingIntent('lista de compras'), true);
  assert.equal(hasShoppingIntent('supermercado'), true);
  assert.equal(hasShoppingIntent('feria del jueves'), true);
  assert.equal(hasShoppingIntent('investigación sobre mascotas'), false);
  assert.equal(hasShoppingIntent('Ideas, notas, mascotas, salud'), false);
});

test('hasPaymentIntent: detecta intención financiera concreta', () => {
  assert.equal(hasPaymentIntent('Pagar internet viernes'), true);
  assert.equal(hasPaymentIntent('abonar cuota del préstamo'), true);
  assert.equal(hasPaymentIntent('vencimiento suscripción'), true);
  assert.equal(hasPaymentIntent('investigar sobre cuentas corrientes'), false);
});

test('shouldBuildShoppingList: requiere señal concreta de compra', () => {
  assert.equal(shouldBuildShoppingList({ itemCount: 3, explicitListIntent: true, hasStoreKeyword: true, hasKnownCategory: true }), true);
  assert.equal(shouldBuildShoppingList({ itemCount: 5, explicitListIntent: true, hasStoreKeyword: false, hasKnownCategory: false }), false);
  assert.equal(shouldBuildShoppingList({ itemCount: 3, explicitListIntent: false, hasStoreKeyword: false, hasKnownCategory: true }), true);
});

// ─── 7 casos requeridos ───────────────────────────────────────────────────────

test('[req-1] texto largo de neurociencia con mascotas → isLongFormNote=true', () => {
  const long = [
    'Busca si hay algo relacionado con mascotas en el mercado.',
    'Visión Estratégica: La Neurociencia como Diferenciador de Producto.',
    '1. Fundamentos de neurociencia aplicada al diseño de interfaces',
    '2. Modelos de atención y memoria en experiencia de usuario digital',
    '3. Arquitectura de sistemas de feedback cognitivo adaptativo',
    '4. Integración de señales biométricas en flujos interactivos',
    '5. Casos de éxito en neuro-UX: empresas y sus resultados concretos',
    '6. Framework de implementación para equipos de producto y diseño',
    'El objetivo es identificar oportunidades de diferenciación a través de la neurociencia.',
  ].join('\n');
  assert.ok(long.length > 500, 'debe ser texto largo');
  // isLongFormNote debe disparar el guard → siempre note
  assert.equal(isLongFormNote(long), true);
  // hasPetAction no debe disparar solo por mencionar mascotas en contexto de investigación
  assert.equal(hasPetAction(long), false);
});

test('[req-2] llevar a Saly al veterinario el viernes → hasPetAction=true', () => {
  assert.equal(hasPetAction('llevar a Saly al veterinario el viernes'), true);
  // no es long-form
  assert.equal(isLongFormNote('llevar a Saly al veterinario el viernes'), false);
});

test('[req-3] comprar comida para Luna mañana → no es long-form, tiene shopping intent', () => {
  const text = 'comprar comida para Luna mañana';
  assert.equal(isLongFormNote(text), false);
  assert.equal(hasShoppingIntent(text), true);
  // hasPetAction es false porque "Luna" no está asociada con perro/gato/mascota en el texto
  assert.equal(hasPetAction(text), false);
});

test('[req-4] lista supermercado leche pan huevos → shopping intent + items conocidos', () => {
  assert.equal(hasShoppingIntent('lista supermercado leche pan huevos'), true);
  assert.equal(shouldBuildShoppingList({
    itemCount: 3,
    explicitListIntent: true,
    hasStoreKeyword: true,
    hasKnownCategory: true,
  }), true);
});

test('[req-5] Pagar internet viernes 29990 → hasPaymentIntent=true', () => {
  assert.equal(hasPaymentIntent('Pagar internet viernes 29990'), true);
  assert.equal(isLongFormNote('Pagar internet viernes 29990'), false);
});

test('[req-6] Ideas, notas, cuentas horas, mascotas, salud → no es lista ni pet', () => {
  const text = 'Ideas, notas, cuentas horas, mascotas, salud';
  // sin items conocidos ni store → no se construye lista de compras
  assert.equal(shouldBuildShoppingList({
    itemCount: 5,
    explicitListIntent: true,
    hasStoreKeyword: false,
    hasKnownCategory: false,
  }), false);
  // mascotas no es acción de mascota
  assert.equal(hasPetAction(text), false);
  // no es long-form
  assert.equal(isLongFormNote(text), false);
  // no tiene intención de compra
  assert.equal(hasShoppingIntent(text), false);
  // no tiene intención de pago
  assert.equal(hasPaymentIntent(text), false);
  // → clasificará como note (ningún guard específico dispara)
});

test('[req-7] busca si hay algo relacionado con mascotas → no es pet', () => {
  const text = 'busca si hay algo relacionado con mascotas';
  assert.equal(hasPetAction(text), false);
  assert.equal(isLongFormNote(text), false);
  assert.equal(hasShoppingIntent(text), false);
  // → clasificará como note o task por 'busca', nunca pet
});
