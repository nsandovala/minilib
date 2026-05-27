import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTokens } from '../src/core/agents/parser-agent.ts';
import { normalizeEntry } from '../src/core/agents/normalizer-agent.ts';
import {
  getPrimarySurface,
  getSecondarySurfaces,
  shouldShowOnSurface,
} from '../src/core/display/surface-resolver.ts';
import { getTodaySpend } from '../src/core/queries/entry-queries.ts';

let seq = 0;

function toTimelineEntry(parsed) {
  seq += 1;
  return {
    id: seq,
    localId: `qa-${seq}`,
    text: parsed.text,
    type: parsed.type,
    title: parsed.title,
    date: parsed.date ?? null,
    time: parsed.time ?? null,
    tags: parsed.tags ?? [],
    done: false,
    amount: parsed.amount ?? null,
    metadata: parsed.metadata ?? null,
    createdAt: new Date(),
    updatedAt: null,
    checklistItems: parsed.checklistItems ?? null,
    listItems: parsed.listItems ?? null,
    listGroups: parsed.listGroups ?? null,
    detectedTags: parsed.detectedTags ?? null,
  };
}

function parseEntry(text) {
  return normalizeEntry(parseTokens(text));
}

test('shopping intent reconoce "compras" y conserva clasificación real de compras', () => {
  const parsed = parseEntry('viernes compras papas fritas, huevos, aceites, pollo');
  const entry = toTimelineEntry(parsed);

  assert.equal(parsed.type, 'shopping_list');
  assert.equal(parsed.metadata?.listKind, 'shopping');
  assert.deepEqual(
    parsed.metadata?.items?.map((item) => item.label),
    ['papas fritas', 'huevos', 'aceites', 'pollo'],
  );
  assert.equal(shouldShowOnSurface(entry, 'purchases'), true);
  assert.equal(getPrimarySurface(entry), 'purchases');
  assert.equal(shouldShowOnSurface(entry, 'notes'), false);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
});

test('shopping intent reconoce "lista de compras" con múltiples ítems', () => {
  const parsed = parseEntry('lista de compras leche, pan, huevos');
  const entry = toTimelineEntry(parsed);

  assert.equal(parsed.type, 'shopping_list');
  assert.equal(parsed.metadata?.listKind, 'shopping');
  assert.deepEqual(
    parsed.metadata?.items?.map((item) => item.label),
    ['leche', 'pan', 'huevos'],
  );
  assert.equal(getPrimarySurface(entry), 'purchases');
  assert.equal(shouldShowOnSurface(entry, 'purchases'), true);
  assert.equal(shouldShowOnSurface(entry, 'notes'), false);
});

test('shopping intent reconoce contextos de supermercado/minimarket/farmacia/ferretería/despensa', () => {
  const cases = [
    'supermercado leche pan huevos',
    'minimarket bebida pan queso',
    'farmacia paracetamol ibuprofeno',
    'ferretería tornillos cinta aisladora',
    'despensa arroz aceite azúcar',
  ];

  for (const text of cases) {
    const parsed = parseEntry(text);
    const entry = toTimelineEntry(parsed);
    assert.equal(parsed.type, 'shopping_list', text);
    assert.equal(parsed.metadata?.listKind, 'shopping', text);
    assert.ok((parsed.metadata?.items?.length ?? 0) >= 2, text);
    assert.equal(shouldShowOnSurface(entry, 'purchases'), true, text);
  }
});

test('listas de proyecto o ideas no se convierten en shopping_list', () => {
  const cases = [
    'Habilitar sketchnoting en notas, integrar Drive Gmail Photos, rediseñar web Amon IT',
    'Drive, Gmail, Photos, Notion, GitHub',
    'Mejorar click y touch de la barra inferior',
  ];

  for (const text of cases) {
    const parsed = parseEntry(text);
    const entry = toTimelineEntry(parsed);
    assert.equal(parsed.type, 'note', text);
    assert.equal(parsed.metadata?.listKind, undefined, text);
    assert.equal(shouldShowOnSurface(entry, 'purchases'), false, text);
    assert.equal(shouldShowOnSurface(entry, 'pets'), false, text);
    assert.equal(shouldShowOnSurface(entry, 'health'), false, text);
    assert.equal(shouldShowOnSurface(entry, 'payments'), false, text);
  }
});

test('comprar regalo para mi novia queda como tarea genérica, no como shopping_list ni pago', () => {
  const parsed = parseEntry('comprar regalo para mi novia');
  const entry = toTimelineEntry(parsed);

  assert.notEqual(parsed.type, 'shopping_list');
  assert.notEqual(parsed.type, 'payment');
  assert.equal(getPrimarySurface(entry), 'todos');
  assert.equal(shouldShowOnSurface(entry, 'calendar'), false);
});

test('comprar bebida 2000 se clasifica como gasto/pago con monto', () => {
  const parsed = parseEntry('comprar bebida 2000');
  const entry = toTimelineEntry(parsed);

  assert.equal(parsed.type, 'payment');
  assert.equal(parsed.amount, 2000);
  assert.equal(getPrimarySurface(entry), 'payments');
  assert.equal(shouldShowOnSurface(entry, 'purchases'), false);
});

test('pastilla Luna lunes 9am mantiene pets como superficie primaria', () => {
  const parsed = parseEntry('pastilla Luna lunes 9am');
  const entry = toTimelineEntry(parsed);

  assert.equal(parsed.type, 'pet');
  assert.equal(getPrimarySurface(entry), 'pets');
  assert.equal(shouldShowOnSurface(entry, 'pets'), true);
  assert.equal(shouldShowOnSurface(entry, 'health'), false);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
  assert.ok(getSecondarySurfaces(entry).includes('calendar'));
  assert.notEqual(parsed.title, 'El lunes');
  assert.notEqual(parsed.title, 'Evento');
});

test('pastilla para la gata Luna 9am el lunes mantiene pets y conserva título útil', () => {
  const parsed = parseEntry('pastilla para la gata Luna 9am el lunes');
  const entry = toTimelineEntry(parsed);

  assert.equal(parsed.type, 'pet');
  assert.equal(getPrimarySurface(entry), 'pets');
  assert.equal(shouldShowOnSurface(entry, 'pets'), true);
  assert.equal(shouldShowOnSurface(entry, 'health'), false);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
  assert.notEqual(parsed.title, 'El lunes');
  assert.notEqual(parsed.title, 'Evento');
  assert.match(parsed.title.toLowerCase(), /pastilla/);
  assert.match(parsed.title, /Luna/i);
});

test('pastilla para el perro Rocky lunes 8am mantiene pets y no aparece en health', () => {
  const parsed = parseEntry('pastilla para el perro Rocky lunes 8am');
  const entry = toTimelineEntry(parsed);

  assert.equal(parsed.type, 'pet');
  assert.equal(getPrimarySurface(entry), 'pets');
  assert.equal(shouldShowOnSurface(entry, 'pets'), true);
  assert.equal(shouldShowOnSurface(entry, 'health'), false);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
  assert.notEqual(parsed.title, 'El lunes');
});

test('dar remedio a Luna viernes 20:00 mantiene pets y no aparece en health', () => {
  const parsed = parseEntry('dar remedio a Luna viernes 20:00');
  const entry = toTimelineEntry(parsed);

  assert.equal(parsed.type, 'pet');
  assert.equal(getPrimarySurface(entry), 'pets');
  assert.equal(shouldShowOnSurface(entry, 'pets'), true);
  assert.equal(shouldShowOnSurface(entry, 'health'), false);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
});

test('tomar pastilla lunes 9am no se clasifica como pet', () => {
  const parsed = parseEntry('tomar pastilla lunes 9am');
  const entry = toTimelineEntry(parsed);

  assert.notEqual(parsed.type, 'pet');
  assert.equal(getPrimarySurface(entry), 'health');
  assert.equal(shouldShowOnSurface(entry, 'pets'), false);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
});

test('Luna veterinario viernes mantiene pets como superficie primaria', () => {
  const parsed = parseEntry('Luna veterinario viernes');
  const entry = toTimelineEntry(parsed);

  assert.equal(parsed.type, 'pet');
  assert.equal(getPrimarySurface(entry), 'pets');
  assert.equal(shouldShowOnSurface(entry, 'pets'), true);
  assert.equal(shouldShowOnSurface(entry, 'health'), false);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
});

test('doctor lunes 9:30 queda en health y preserva título útil', () => {
  const parsed = parseEntry('doctor lunes 9:30');
  const entry = toTimelineEntry(parsed);

  assert.equal(getPrimarySurface(entry), 'health');
  assert.equal(shouldShowOnSurface(entry, 'health'), true);
  assert.equal(shouldShowOnSurface(entry, 'pets'), false);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
  assert.notEqual(parsed.title, 'Evento');
  assert.match(parsed.title.toLowerCase(), /(doctor|cita medica|cita médica)/);
});

test('ir al médico el sábado a las 15:00 queda en health y no usa evento genérico', () => {
  const parsed = parseEntry('ir al médico el sábado a las 15:00');
  const entry = toTimelineEntry(parsed);

  assert.equal(getPrimarySurface(entry), 'health');
  assert.equal(shouldShowOnSurface(entry, 'health'), true);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
  assert.equal(shouldShowOnSurface(entry, 'notes'), false);
  assert.doesNotMatch(parsed.title, /^Evento(?:\s+\d+)?$/);
  assert.match(parsed.title.toLowerCase(), /(ir al medico|ir al médico|medico|médico)/);
});

test('terapia kine martes a las 17:00 queda en health con calendario secundario', () => {
  const parsed = parseEntry('terapia kine martes a las 17:00');
  const entry = toTimelineEntry(parsed);

  assert.equal(getPrimarySurface(entry), 'health');
  assert.equal(shouldShowOnSurface(entry, 'health'), true);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
  assert.doesNotMatch(parsed.title, /^Evento(?:\s+\d+)?$/);
  assert.match(parsed.title.toLowerCase(), /(terapia|kine)/);
});

test('evento genérico con fecha queda en calendar y no usa título vacío', () => {
  const parsed = parseEntry('partido con amigos miércoles 19:30');
  const entry = toTimelineEntry(parsed);

  assert.equal(getPrimarySurface(entry), 'calendar');
  assert.equal(shouldShowOnSurface(entry, 'calendar'), true);
  assert.equal(shouldShowOnSurface(entry, 'pets'), false);
  assert.equal(shouldShowOnSurface(entry, 'health'), false);
  assert.equal(shouldShowOnSurface(entry, 'notes'), false);
  assert.notEqual(parsed.title, 'Evento');
  assert.notEqual(parsed.title, 'Evento 1');
  assert.match(parsed.title.toLowerCase(), /partido con amigos/);
});

test('idea de producto sigue siendo note y no contamina surfaces de dominio', () => {
  const parsed = parseEntry('Drive, Gmail, Photos, Notion, GitHub, herramientas para poder conectar con Liev');
  const entry = toTimelineEntry(parsed);

  assert.equal(parsed.type, 'note');
  assert.equal(getPrimarySurface(entry), 'notes');
  assert.equal(shouldShowOnSurface(entry, 'notes'), true);
  assert.equal(shouldShowOnSurface(entry, 'purchases'), false);
  assert.equal(shouldShowOnSurface(entry, 'health'), false);
  assert.equal(shouldShowOnSurface(entry, 'pets'), false);
  assert.equal(shouldShowOnSurface(entry, 'calendar'), false);
});

test('getTodaySpend no cuenta nota o tarea genérica con monto', () => {
  const spend = getTodaySpend([
    {
      id: 1,
      localId: 'spend-note',
      type: 'task',
      title: 'Comprar regalo',
      text: 'comprar regalo',
      date: null,
      time: null,
      tags: ['task'],
      done: false,
      amount: 10000,
      metadata: null,
      createdAt: new Date(),
      updatedAt: null,
      checklistItems: null,
      listItems: null,
      listGroups: null,
      detectedTags: null,
    },
  ]);

  assert.equal(spend, 0);
});

test('getTodaySpend cuenta pago o gasto explícito con monto', () => {
  const spend = getTodaySpend([
    {
      id: 2,
      localId: 'spend-payment',
      type: 'payment',
      title: 'Comprar regalo',
      text: 'comprar regalo',
      date: null,
      time: null,
      tags: ['payment', 'expense'],
      done: false,
      amount: 10000,
      metadata: { direction: 'expense' },
      createdAt: new Date(),
      updatedAt: null,
      checklistItems: null,
      listItems: null,
      listGroups: null,
      detectedTags: null,
    },
  ]);

  assert.equal(spend, 10000);
});

test('shopping_list sin estado pagado no infla getTodaySpend', () => {
  const parsed = parseEntry('supermercado leche pan');
  const spend = getTodaySpend([toTimelineEntry(parsed)]);
  assert.equal(spend, 0);
});

test('calendar metadata no bloquea purchases, pets ni health cuando el dominio es más fuerte', () => {
  const purchasesEntry = toTimelineEntry(parseEntry('viernes compras papas fritas, huevos, aceites'));
  const petsEntry = toTimelineEntry(parseEntry('pastilla Luna lunes 9am'));
  const healthEntry = toTimelineEntry(parseEntry('doctor lunes 9:30'));

  assert.equal(getPrimarySurface(purchasesEntry), 'purchases');
  assert.equal(getPrimarySurface(petsEntry), 'pets');
  assert.equal(getPrimarySurface(healthEntry), 'health');

  assert.equal(shouldShowOnSurface(purchasesEntry, 'calendar'), true);
  assert.equal(shouldShowOnSurface(petsEntry, 'calendar'), true);
  assert.equal(shouldShowOnSurface(healthEntry, 'calendar'), true);
});
