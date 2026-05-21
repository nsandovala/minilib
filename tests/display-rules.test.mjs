import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCalendarDisplayCopy,
  shouldShowCalmExplanation,
  shouldShowCorrectionHint,
  shouldShowOriginalText,
} from '../src/core/display/display-rules.ts';

let seq = 0;

function makeEntry(overrides = {}) {
  seq += 1;
  return {
    id: seq,
    localId: `display-${seq}`,
    type: 'note',
    title: 'Nota',
    text: 'Texto de prueba',
    date: null,
    time: null,
    tags: ['note'],
    done: false,
    amount: null,
    metadata: null,
    createdAt: new Date('2026-05-19T10:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

test('oculta calmExplanation genérica por defecto aunque la card esté expandida', () => {
  const entry = makeEntry();
  assert.equal(
    shouldShowCalmExplanation(entry, {
      expanded: true,
      currentSurface: 'notes',
      primarySurface: 'notes',
      calmExplanation: 'Guardé esto como nota para evitar ruido en tu flujo de trabajo.',
    }),
    false,
  );
});

test('muestra correctionHint para note ambigua que parece pago', () => {
  const entry = makeEntry({
    title: 'Pagar internet',
    text: 'Pagar internet viernes',
  });

  assert.equal(
    shouldShowCorrectionHint(entry, {
      expanded: true,
      currentSurface: 'notes',
      primarySurface: 'notes',
      correctionHint: 'Si es una tarea o pago, puedes reclasificar desde el menú de la tarjeta.',
    }),
    true,
  );
});

test('oculta texto original para calendario con eventos estructurados', () => {
  const entry = makeEntry({
    title: '2 eventos',
    text: 'sábado 2 eventos primero a las 17:30 partido segundo a las 21:30 cena',
    metadata: {
      calendar: {
        kind: 'multi_event',
        events: [
          { order: 1, time: '17:30', label: 'Partido' },
          { order: 2, time: '21:30', label: 'Cena' },
        ],
      },
    },
  });

  assert.equal(shouldShowOriginalText(entry, { expanded: true }), false);
});

test('getCalendarDisplayCopy resume agenda del día con eventos', () => {
  const entry = makeEntry({
    metadata: {
      calendar: {
        kind: 'multi_event',
        events: [{ order: 1, time: '17:30', label: 'Partido' }],
      },
    },
  });

  assert.deepEqual(getCalendarDisplayCopy(entry), {
    headline: 'Agenda del día',
    pendingLabel: null,
    prompt: null,
  });
});

test('getCalendarDisplayCopy muestra día con eventos por confirmar si faltan horarios', () => {
  const entry = makeEntry({
    metadata: {
      calendar: {
        kind: 'multi_event',
        expectedCount: 2,
        events: [],
      },
    },
  });

  assert.deepEqual(getCalendarDisplayCopy(entry), {
    headline: 'Día con eventos por confirmar',
    pendingLabel: '2 eventos por detallar',
    prompt: 'Agrega horarios para ordenar este día.',
  });
});
