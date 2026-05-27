import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldShowOnSurface,
  isLongFormNote,
  getPrimarySurface,
  getSecondarySurfaces,
  resolveSurfaceForEntry,
} from '../src/core/display/surface-resolver.ts';

let seq = 0;
function makeEntry(overrides = {}) {
  seq += 1;
  return {
    id: seq,
    localId: `sr-${seq}`,
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

// ─── isLongFormNote ───────────────────────────────────────────────────────────

test('short entry is not a long-form note', () => {
  const e = makeEntry({ title: 'Saly veterinario viernes', text: 'Saly veterinario viernes 17:30' });
  assert.equal(isLongFormNote(e), false);
});

test('entry >500 chars is a long-form note', () => {
  const e = makeEntry({
    title: 'nota larga',
    text: 'a'.repeat(501),
  });
  assert.equal(isLongFormNote(e), true);
});

test('entry with numbered sections is a long-form note', () => {
  const e = makeEntry({
    title: 'investigacion',
    text: 'intro\n1. primera sección\n2. segunda sección\n3. tercera sección con detalles importantes',
  });
  assert.equal(isLongFormNote(e), true);
});

test('entry with markdown headers is a long-form note', () => {
  const e = makeEntry({ text: '## Sección principal\ncontenido aquí' });
  assert.equal(isLongFormNote(e), true);
});

test('entry with multiple paragraphs >200 chars is a long-form note', () => {
  const e = makeEntry({
    text: 'Este es el primer párrafo con bastante contenido descriptivo que llena el espacio necesario.\n\nEste es el segundo párrafo también con bastante contenido descriptivo para superar el umbral de doscientos caracteres en total en el texto del entry y activar la guarda de nota larga.',
  });
  assert.ok(e.text.length > 200, `text length should exceed 200 (got ${e.text.length})`);
  assert.equal(isLongFormNote(e), true);
});

test('entry with doc keywords is a long-form note', () => {
  const e = makeEntry({ title: 'Módulo mascotas', text: 'Análisis del módulo mascotas del sistema' });
  assert.equal(isLongFormNote(e), true);
});

// ─── Pets surface ─────────────────────────────────────────────────────────────

test('long research note mentioning mascotas does NOT show in pets', () => {
  const e = makeEntry({
    type: 'note',
    title: 'Investigación módulo mascotas',
    text: [
      'Investigación sobre el módulo mascotas en la plataforma Liev.',
      'Este documento analiza las categorías de mascotas disponibles.',
      '1. Primera sección sobre veterinarios en el sistema.',
      '2. Segunda sección sobre comida y alimento para perros y gatos.',
      '3. Tercera sección sobre controles médicos y vacunas.',
      'El sistema debe permitir registrar citas veterinarias y vacunas para mascotas.',
    ].join('\n'),
  });
  assert.equal(shouldShowOnSurface(e, 'pets'), false, 'research note must not appear in pets');
  assert.equal(shouldShowOnSurface(e, 'notes'), true, 'research note should appear in notes');
});

test('"Saly veterinario viernes 17:30" shows in pets', () => {
  const e = makeEntry({
    type: 'pet',
    title: 'Saly veterinario viernes 17:30',
    text: 'Saly veterinario viernes 17:30',
    date: '2026-05-24',
  });
  assert.equal(shouldShowOnSurface(e, 'pets'), true);
});

test('"Saly veterinario" has pets as primary surface and home as secondary', () => {
  const e = makeEntry({
    type: 'pet',
    title: 'Saly veterinario',
    text: 'Saly veterinario viernes 17:30',
    date: '2026-05-24',
  });
  assert.equal(getPrimarySurface(e), 'pets');
  const secondary = getSecondarySurfaces(e);
  assert.ok(secondary.includes('home'), 'secondary should include home');
});

test('legacy pet entry that is actually a long research doc resolves to notes primary', () => {
  const e = makeEntry({
    type: 'pet',
    done: true,
    title: 'Investigación mascotas',
    text: [
      'Investigación sobre el módulo de mascotas. Este documento describe la arquitectura.',
      '1. Primera sección sobre registro de mascotas.',
      '2. Segunda sección sobre citas veterinarias.',
      '3. Tercera sección sobre alimentación y cuidado en detalle.',
      'El objetivo del módulo es permitir a los usuarios gestionar la salud de sus mascotas.',
    ].join('\n'),
  });
  assert.equal(getPrimarySurface(e), 'notes', 'legacy mis-typed research doc resolves to notes');
  assert.equal(shouldShowOnSurface(e, 'pets'), false, 'must not appear in pets');
  assert.equal(shouldShowOnSurface(e, 'notes'), true, 'should appear in notes');
  const { isLegacyOverride } = resolveSurfaceForEntry(e);
  assert.equal(isLegacyOverride, true, 'should be flagged as legacy override');
});

test('short type=pet entry is trusted and shows in pets even without explicit care keywords', () => {
  // Short entries with type=pet are assumed to be valid pet records.
  // The long-form guard (isLongFormNote) is the primary defense; type alone is enough for short entries.
  const e = makeEntry({
    type: 'pet',
    title: 'mi mascota',
    text: 'mi mascota',
  });
  assert.equal(getPrimarySurface(e), 'pets');
  assert.equal(shouldShowOnSurface(e, 'pets'), true);
});

// ─── Purchases surface ────────────────────────────────────────────────────────

test('long research note mentioning compras does NOT show in purchases', () => {
  const e = makeEntry({
    type: 'note',
    title: 'Análisis flujo compras',
    text: [
      'Análisis del flujo de compras en la plataforma Liev.',
      'Este documento describe la arquitectura del módulo de compras.',
      '1. Supermercado: para compras generales del mercado.',
      '2. Feria: para productos frescos y verduras.',
      '3. Farmacia: para medicamentos y remedios.',
      'El objetivo es mejorar la experiencia en el supermercado y feria.',
    ].join('\n'),
  });
  assert.equal(shouldShowOnSurface(e, 'purchases'), false, 'research note must not appear in purchases');
  assert.equal(shouldShowOnSurface(e, 'notes'), true);
});

test('"lista supermercado leche huevos pan" shows in purchases', () => {
  const e = makeEntry({
    type: 'shopping_list',
    title: 'lista supermercado',
    text: 'leche huevos pan',
  });
  assert.equal(shouldShowOnSurface(e, 'purchases'), true);
});

test('shopping metadata entry shows in purchases even with malformed items array', () => {
  const e = makeEntry({
    type: 'shopping_list',
    title: 'lista compras',
    text: 'lista de compras',
    metadata: {
      listKind: 'shopping',
      items: null,       // malformed — should not crash
      progress: null,
    },
  });
  // Should not throw, and should still show in purchases (type=shopping_list)
  assert.doesNotThrow(() => shouldShowOnSurface(e, 'purchases'));
  assert.equal(shouldShowOnSurface(e, 'purchases'), true);
});

// ─── Payments surface ─────────────────────────────────────────────────────────

test('"pagar internet 29990 viernes" shows in payments', () => {
  const e = makeEntry({
    type: 'payment',
    title: 'pagar internet',
    text: 'pagar internet 29990 viernes',
    amount: 29990,
  });
  assert.equal(shouldShowOnSurface(e, 'payments'), true);
  assert.equal(getPrimarySurface(e), 'payments');
});

test('payment entry without amount does NOT show in payments', () => {
  const e = makeEntry({
    type: 'payment',
    title: 'pagar algo',
    text: 'pagar algo',
    amount: null,
  });
  assert.equal(shouldShowOnSurface(e, 'payments'), false);
  assert.equal(getPrimarySurface(e), 'notes');
});

test('note entry with a number does NOT show in payments', () => {
  const e = makeEntry({
    type: 'note',
    title: 'compré 3 cosas',
    text: 'compré 3 cosas en el mercado',
    amount: null,
  });
  assert.equal(shouldShowOnSurface(e, 'payments'), false);
});

// ─── Calendar surface ─────────────────────────────────────────────────────────

test('calendar metadata entry shows in calendar, NOT in notes, purchases or pets', () => {
  const e = makeEntry({
    type: 'note',
    title: 'sábado reunión equipo y compras en el mercado',
    text: 'sábado reunión con equipo a las 10:00 y después ir al mercado a comprar',
    metadata: {
      calendar: {
        kind: 'single_event',
        events: [{ order: 1, time: '10:00', label: 'Reunión equipo' }],
      },
    },
    date: '2026-05-23',
  });
  assert.equal(shouldShowOnSurface(e, 'calendar'), true, 'must show in calendar');
  assert.equal(shouldShowOnSurface(e, 'notes'), false, 'generic calendar entry must stay out of notes');
  assert.equal(shouldShowOnSurface(e, 'purchases'), false, 'must NOT show in purchases despite "mercado"');
  assert.equal(shouldShowOnSurface(e, 'pets'), false, 'must NOT show in pets');
  assert.equal(getPrimarySurface(e), 'calendar');
  const secondary = getSecondarySurfaces(e);
  assert.ok(!secondary.includes('notes'));
  assert.ok(secondary.includes('home'), 'dated calendar entry should be in home secondary');
});

test('calendar entry without date does not include home in secondary', () => {
  const e = makeEntry({
    type: 'note',
    title: 'evento sin fecha',
    text: 'evento sin fecha',
    metadata: {
      calendar: { kind: 'single_event', events: [] },
    },
    date: null,
  });
  const secondary = getSecondarySurfaces(e);
  assert.ok(!secondary.includes('home'), 'undated calendar entry should not be in home secondary');
});

// ─── Health surface ───────────────────────────────────────────────────────────

test('health entry shows in health surface', () => {
  const e = makeEntry({
    type: 'health',
    title: 'control médico lunes',
    text: 'control médico lunes 9:00',
    date: '2026-05-25',
  });
  assert.equal(shouldShowOnSurface(e, 'health'), true);
  assert.equal(getPrimarySurface(e), 'health');
});

test('pet medicine entry does NOT show in health surface', () => {
  const e = makeEntry({
    type: 'pet',
    title: 'Pastilla Luna',
    text: 'pastilla Luna lunes 9am',
    date: '2026-06-01',
    metadata: {
      calendar: {
        kind: 'single_event',
        events: [{ order: 1, time: '09:00', label: 'Pastilla Luna' }],
      },
    },
  });
  assert.equal(shouldShowOnSurface(e, 'pets'), true);
  assert.equal(shouldShowOnSurface(e, 'health'), false);
  assert.equal(shouldShowOnSurface(e, 'calendar'), true);
  assert.equal(getPrimarySurface(e), 'pets');
});

// ─── Shopping list / pets hardening ──────────────────────────────────────────

test('shopping list with vet text does NOT show in pets', () => {
  const e = makeEntry({
    type: 'shopping_list',
    title: 'compras semana',
    text: 'comida veterinario arena del gato leche pan',
    metadata: { listKind: 'shopping', items: [] },
  });
  assert.equal(shouldShowOnSurface(e, 'pets'), false, 'shopping list must not appear in pets');
  assert.equal(shouldShowOnSurface(e, 'purchases'), true, 'shopping list must appear in purchases');
});

test('shopping list with vet text primary surface is purchases, not pets', () => {
  const e = makeEntry({
    type: 'shopping_list',
    title: 'lista veterinario',
    text: 'comida perro, vacuna, arena, pastilla',
    metadata: { listKind: 'shopping', items: [] },
  });
  assert.equal(getPrimarySurface(e), 'purchases');
});

test('metadata-based shopping list (listKind=shopping, non-shopping_list type) shows in purchases', () => {
  const e = makeEntry({
    type: 'note',
    title: 'lista compras',
    text: 'leche pan arroz',
    metadata: { listKind: 'shopping', items: [{ name: 'leche', checked: false, price: null }] },
  });
  assert.equal(shouldShowOnSurface(e, 'purchases'), true, 'metadata shopping must appear in purchases');
  assert.equal(shouldShowOnSurface(e, 'pets'), false, 'metadata shopping must NOT appear in pets');
});
