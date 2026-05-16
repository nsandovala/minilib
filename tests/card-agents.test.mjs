import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCardAgent,
  resolveSurfaceForEntry,
  getAgentForType,
  ALL_AGENTS,
} from '../src/core/card-agents/index.ts';

// ── Helpers ────────────────────────────────────────────────────────────────────

let _seq = 0;
function makeEntry(overrides = {}) {
  _seq += 1;
  return {
    localId:   `entry-${_seq}`,
    type:      'note',
    title:     'Test',
    text:      '',
    tags:      [],
    done:      false,
    date:      null,
    time:      null,
    amount:    null,
    metadata:  null,
    createdAt: new Date('2026-05-16T10:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

const LONG_PET_RESEARCH = `
Investigación sobre enfermedades comunes en perros y gatos domésticos.
1. Parvovirosis canina: causas, síntomas y tratamiento
2. Leucemia felina: diagnóstico y prevención
3. Leishmaniasis: transmisión por flebótomos en zonas cálidas
4. Leptospirosis: riesgo zoonótico y protocolo vacunal
5. Dermatofitosis: tiña en mascotas y contagio a humanos
Fuentes: AVMA, WSAVA, estudios PubMed 2020-2025.
`.repeat(4); // > 500 chars → long-form note

// ── Surface resolution ─────────────────────────────────────────────────────────

test('texto largo de investigación que menciona mascotas → surface notes (no pets)', () => {
  // Entry already classified as 'note' (long-form guard fired at parse time).
  // The card agent must NOT re-route it to pets just because it mentions animals.
  const entry = makeEntry({ type: 'note', text: LONG_PET_RESEARCH });
  assert.equal(resolveSurfaceForEntry(entry), 'notes');
});

test('acción concreta de mascota → surface pets', () => {
  const entry = makeEntry({ type: 'pet', text: 'Llevar a Lola al veterinario' });
  assert.equal(resolveSurfaceForEntry(entry), 'pets');
});

test('pago pendiente → primary surface payments', () => {
  const entry = makeEntry({ type: 'payment', amount: 50000, date: '2026-05-16' });
  assert.equal(resolveCardAgent(entry).surface, 'payments');
});

test('pago con fecha → también aparece en home (secondary surface)', () => {
  const entry = makeEntry({ type: 'payment', amount: 50000, date: '2026-05-16', done: false });
  const { allSurfaces } = resolveCardAgent(entry);
  assert.ok(allSurfaces.includes('home'), 'payment con fecha debe incluir home como superficie secundaria');
});

test('lista de compras → surface purchases', () => {
  const entry = makeEntry({ type: 'shopping_list' });
  assert.equal(resolveSurfaceForEntry(entry), 'purchases');
});

test('tarea → surface todos', () => {
  const entry = makeEntry({ type: 'task' });
  assert.equal(resolveSurfaceForEntry(entry), 'todos');
});

test('recordatorio (reminder) → surface todos', () => {
  const entry = makeEntry({ type: 'reminder' });
  assert.equal(resolveSurfaceForEntry(entry), 'todos');
});

test('salud → surface health', () => {
  const entry = makeEntry({ type: 'health' });
  assert.equal(resolveSurfaceForEntry(entry), 'health');
});

test('cita médica (appointment) → surface health', () => {
  const entry = makeEntry({ type: 'appointment' });
  assert.equal(resolveSurfaceForEntry(entry), 'health');
});

// ── Done / deprioritized ───────────────────────────────────────────────────────

test('entrada completada → deprioritized: true', () => {
  const entry = makeEntry({ type: 'task', done: true });
  assert.equal(resolveCardAgent(entry).deprioritized, true);
});

test('entrada completada → no aparece en home (sin secondary surfaces)', () => {
  const entry = makeEntry({ type: 'payment', amount: 5000, date: '2026-05-16', done: true });
  const { allSurfaces } = resolveCardAgent(entry);
  assert.ok(!allSurfaces.includes('home'), 'pago completado no debe aparecer en home');
});

test('entrada pendiente → deprioritized: false', () => {
  const entry = makeEntry({ type: 'task', done: false });
  assert.equal(resolveCardAgent(entry).deprioritized, false);
});

// ── Secondary surface conditions ───────────────────────────────────────────────

test('pago sin fecha ni amount → sin secondary surfaces', () => {
  const entry = makeEntry({ type: 'payment', amount: null, date: null });
  const { allSurfaces } = resolveCardAgent(entry);
  assert.ok(!allSurfaces.includes('home'), 'pago sin fecha ni amount no debe aparecer en home');
});

test('mascota con fecha → aparece en home también', () => {
  const entry = makeEntry({ type: 'pet', date: '2026-05-16', done: false });
  const { allSurfaces } = resolveCardAgent(entry);
  assert.ok(allSurfaces.includes('home'), 'mascota con fecha debe aparecer en home');
});

// ── Fallback ───────────────────────────────────────────────────────────────────

test('tipo desconocido → fallback a note agent (surface notes)', () => {
  const entry = makeEntry({ type: 'future_unknown_type' });
  const result = resolveCardAgent(entry);
  assert.equal(result.surface, 'notes');
  assert.equal(result.agentId, 'note');
});

// ── Agent registry ─────────────────────────────────────────────────────────────

test('getAgentForType devuelve el agente correcto para payment', () => {
  const agent = getAgentForType('payment');
  assert.ok(agent, 'debe existir agente para payment');
  assert.equal(agent.id, 'payment');
  assert.equal(agent.surfaces.primary, 'payments');
});

test('todos los agentes tienen calmExplanation no vacío', () => {
  for (const agent of ALL_AGENTS) {
    assert.ok(
      agent.ui.calmExplanation.length > 0,
      `${agent.id}: calmExplanation no debe estar vacío`,
    );
  }
});

test('todos los agentes tienen emptyState con título y cuerpo', () => {
  for (const agent of ALL_AGENTS) {
    assert.ok(agent.ui.emptyState.title.length > 0, `${agent.id}: emptyState.title vacío`);
    assert.ok(agent.ui.emptyState.body.length > 0,  `${agent.id}: emptyState.body vacío`);
  }
});
