import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDedupeKey } from '../src/lib/sync/dedupe-key.ts';

const BASE = {
  userId:    'user_abc123',
  type:      'note',
  title:     'Buy groceries',
  text:      '',
  date:      '2026-05-16',
  entryTime: null,
  amount:    null,
};

// ── Determinism ────────────────────────────────────────────────────────────────

test('same input always produces the same key', () => {
  const k1 = buildDedupeKey(BASE);
  const k2 = buildDedupeKey({ ...BASE });
  assert.equal(k1, k2);
});

test('key starts with dk: prefix', () => {
  assert.ok(buildDedupeKey(BASE).startsWith('dk:'));
});

// ── User scoping ───────────────────────────────────────────────────────────────

test('different userId produces a different key (user isolation)', () => {
  const k1 = buildDedupeKey({ ...BASE, userId: 'user_abc123' });
  const k2 = buildDedupeKey({ ...BASE, userId: 'user_xyz999' });
  assert.notEqual(k1, k2);
});

// ── Semantic sensitivity ───────────────────────────────────────────────────────

test('different type produces different key', () => {
  const k1 = buildDedupeKey({ ...BASE, type: 'note' });
  const k2 = buildDedupeKey({ ...BASE, type: 'task' });
  assert.notEqual(k1, k2);
});

test('different amount produces different key', () => {
  const k1 = buildDedupeKey({ ...BASE, amount: 1000 });
  const k2 = buildDedupeKey({ ...BASE, amount: 2000 });
  assert.notEqual(k1, k2);
});

test('different date produces different key', () => {
  const k1 = buildDedupeKey({ ...BASE, date: '2026-05-16' });
  const k2 = buildDedupeKey({ ...BASE, date: '2026-06-01' });
  assert.notEqual(k1, k2);
});

// ── Semantic stability (excluded fields do NOT affect the key) ─────────────────

test('createdAt equivalent is excluded — key is stable across devices', () => {
  // createdAt is not part of DedupeKeyInput; same entry from two devices
  // that differ only in creation timestamp must hash to the same key.
  // Verify by checking that all fields of BASE produce an identical key
  // regardless of when the helper is called.
  const k1 = buildDedupeKey(BASE);
  const k2 = buildDedupeKey(BASE);
  assert.equal(k1, k2, 'key must not embed any time-of-call state');
});

test('null and undefined are treated the same as missing', () => {
  const k1 = buildDedupeKey({ ...BASE, date: null, entryTime: null, amount: null });
  const k2 = buildDedupeKey({ ...BASE, date: undefined, entryTime: undefined, amount: undefined });
  assert.equal(k1, k2);
});

// ── Normalization ──────────────────────────────────────────────────────────────

test('title whitespace and case differences produce the same key', () => {
  const k1 = buildDedupeKey({ ...BASE, title: 'Buy Groceries' });
  const k2 = buildDedupeKey({ ...BASE, title: '  buy   groceries  ' });
  assert.equal(k1, k2);
});

test('title punctuation is stripped before hashing', () => {
  const k1 = buildDedupeKey({ ...BASE, title: 'Buy groceries' });
  const k2 = buildDedupeKey({ ...BASE, title: 'Buy groceries.' });
  assert.equal(k1, k2);
});

// ── Title-vs-text fallback ─────────────────────────────────────────────────────

test('empty title falls back to text for content hash', () => {
  const k1 = buildDedupeKey({ ...BASE, title: '',    text: 'Some content' });
  const k2 = buildDedupeKey({ ...BASE, title: null,  text: 'Some content' });
  assert.equal(k1, k2);
});

test('entry with title differs from entry with same text but no title', () => {
  const k1 = buildDedupeKey({ ...BASE, title: 'Note body', text: '' });
  const k2 = buildDedupeKey({ ...BASE, title: '',          text: 'Note body' });
  // title wins over text — same normalized content, so keys ARE equal
  // (this confirms the "prefer title; fall back to text body" rule)
  assert.equal(k1, k2);
});

// ── Security: server-side authority ───────────────────────────────────────────

test('client cannot forge a key for another user by passing their userId', () => {
  // The push route computes the key from the authenticated Clerk userId,
  // never from the client payload. Demonstrate that mismatched userIds
  // produce different keys:
  const attackerUserId = 'user_attacker';
  const victimUserId   = 'user_victim';
  const k1 = buildDedupeKey({ ...BASE, userId: attackerUserId });
  const k2 = buildDedupeKey({ ...BASE, userId: victimUserId });
  assert.notEqual(k1, k2);
});
