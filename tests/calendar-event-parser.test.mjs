import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendarEventInput, sortCalendarEvents } from '../src/core/calendar/event-parser.ts';

const BASE_DATE = new Date('2026-05-18T12:00:00Z'); // lunes

test('parser de calendario detecta fecha y cantidad sin detalles', () => {
  const parsed = parseCalendarEventInput('sábado 2 eventos', BASE_DATE);

  assert.equal(parsed.matched, true);
  assert.equal(parsed.title, '2 eventos');
  assert.equal(parsed.date, '2026-05-23');
  assert.equal(parsed.time, null);
  assert.deepEqual(parsed.metadata, {
    calendar: {
      kind: 'multi_event',
      expectedCount: 2,
      events: [],
    },
  });
});

test('parser de calendario detecta múltiples horarios y etiquetas', () => {
  const parsed = parseCalendarEventInput(
    'sábado 2 eventos primero a las 17:30 partido segundo a las 21:30 cena',
    BASE_DATE,
  );

  assert.equal(parsed.matched, true);
  assert.equal(parsed.title, '2 eventos');
  assert.equal(parsed.date, '2026-05-23');
  assert.equal(parsed.time, '17:30');
  assert.deepEqual(parsed.metadata?.calendar.events, [
    { order: 1, time: '17:30', label: 'Partido' },
    { order: 2, time: '21:30', label: 'Cena' },
  ]);
});

test('parser de calendario acepta conteo en palabras y eventos sin etiqueta', () => {
  const parsed = parseCalendarEventInput(
    'jueves dos eventos el primero a las 13:00 segundo a las 19:30',
    BASE_DATE,
  );

  assert.equal(parsed.matched, true);
  assert.equal(parsed.title, '2 eventos');
  assert.equal(parsed.date, '2026-05-21');
  assert.deepEqual(parsed.metadata?.calendar.events, [
    { order: 1, time: '13:00', label: '' },
    { order: 2, time: '19:30', label: '' },
  ]);
});

test('sortCalendarEvents ordena por hora', () => {
  const sorted = sortCalendarEvents([
    { order: 2, time: '21:30', label: 'Cena' },
    { order: 1, time: '17:30', label: 'Partido' },
  ]);

  assert.deepEqual(sorted.map((event) => event.time), ['17:30', '21:30']);
});

test('parser entrega metadata.calendar lista para guardarse en entry.metadata', () => {
  const parsed = parseCalendarEventInput('sábado 2 eventos primero a las 17:30 partido segundo a las 21:30 cena', BASE_DATE);

  assert.equal(parsed.metadata?.calendar.kind, 'multi_event');
  assert.equal(parsed.metadata?.calendar.expectedCount, undefined);
  assert.deepEqual(parsed.metadata?.calendar.events, [
    { order: 1, time: '17:30', label: 'Partido' },
    { order: 2, time: '21:30', label: 'Cena' },
  ]);
});
