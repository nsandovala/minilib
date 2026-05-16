import test from 'node:test';
import assert from 'node:assert/strict';
import { groupEntriesForCognitiveTimeline } from '../src/core/cognitive/group.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const TOMORROW = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

let _seq = 0;
function makeEntry(overrides = {}) {
  _seq += 1;
  return {
    localId:  `entry-${_seq}`,
    type:     'note',
    title:    'Test',
    text:     '',
    tags:     [],
    done:     false,
    date:     null,
    time:     null,
    amount:   null,
    metadata: null,
    createdAt: new Date('2026-05-16T10:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('pendientes aparecen antes que completadas', () => {
  const entries = [
    makeEntry({ localId: 'done-1', done: true, date: TODAY }),
    makeEntry({ localId: 'pending-1', done: false, date: TODAY, type: 'task' }),
  ];
  const { groups } = groupEntriesForCognitiveTimeline(entries);
  // First group must not be completed
  assert.notEqual(groups[0]?.key, 'completed');
  // Completed must be the last group
  const lastGroup = groups[groups.length - 1];
  assert.equal(lastGroup?.key, 'completed');
});

test('done=true va al grupo completed', () => {
  const entries = [
    makeEntry({ localId: 'done-1', done: true }),
    makeEntry({ localId: 'done-2', done: true, date: YESTERDAY }),
    makeEntry({ localId: 'pending-1', done: false }),
  ];
  const { groups } = groupEntriesForCognitiveTimeline(entries);
  const completedGroup = groups.find((g) => g.key === 'completed');
  assert.ok(completedGroup, 'debe existir grupo completed');
  assert.equal(completedGroup.entries.length, 2);
  const ids = completedGroup.entries.map((e) => e.localId);
  assert.ok(ids.includes('done-1'));
  assert.ok(ids.includes('done-2'));
});

test('pago pendiente de hoy va al grupo now', () => {
  const entries = [
    makeEntry({ localId: 'payment-today', type: 'payment', done: false, date: TODAY }),
    makeEntry({ localId: 'note-today',    type: 'note',    done: false, date: TODAY }),
  ];
  const { groups } = groupEntriesForCognitiveTimeline(entries);
  const nowGroup = groups.find((g) => g.key === 'now');
  assert.ok(nowGroup, 'debe existir grupo now');
  const nowIds = nowGroup.entries.map((e) => e.localId);
  assert.ok(nowIds.includes('payment-today'), 'pago hoy debe estar en now');
});

test('fecha futura va al grupo soon', () => {
  const entries = [
    makeEntry({ localId: 'future', done: false, date: TOMORROW }),
    makeEntry({ localId: 'today',  done: false, date: TODAY, type: 'task' }),
  ];
  const { groups } = groupEntriesForCognitiveTimeline(entries);
  const soonGroup = groups.find((g) => g.key === 'soon');
  assert.ok(soonGroup, 'debe existir grupo soon');
  assert.equal(soonGroup.entries[0]?.localId, 'future');
});

test('sin fecha pendiente va al grupo unscheduled', () => {
  const entries = [
    makeEntry({ localId: 'no-date', done: false, date: null }),
    makeEntry({ localId: 'with-date', done: false, date: TODAY, type: 'payment' }),
  ];
  const { groups } = groupEntriesForCognitiveTimeline(entries);
  const unscheduledGroup = groups.find((g) => g.key === 'unscheduled');
  assert.ok(unscheduledGroup, 'debe existir grupo unscheduled');
  assert.equal(unscheduledGroup.entries[0]?.localId, 'no-date');
});

test('vencida va al grupo now', () => {
  const entries = [
    makeEntry({ localId: 'overdue', done: false, date: YESTERDAY, type: 'task' }),
  ];
  const { groups } = groupEntriesForCognitiveTimeline(entries);
  const nowGroup = groups.find((g) => g.key === 'now');
  assert.ok(nowGroup);
  assert.equal(nowGroup.entries[0]?.localId, 'overdue');
});

test('lista vacía devuelve isEmpty=true', () => {
  const result = groupEntriesForCognitiveTimeline([]);
  assert.equal(result.isEmpty, true);
  assert.equal(result.groups.length, 0);
});
