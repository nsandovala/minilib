import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCLP } from '../src/lib/money.ts';

test('separador de miles chileno (punto)', () => {
  assert.equal(normalizeCLP('2.900'), 2900);
  assert.equal(normalizeCLP('12.500'), 12500);
  assert.equal(normalizeCLP('220.000'), 220000);
});

test('símbolo $ con y sin espacio', () => {
  assert.equal(normalizeCLP('$2.900'), 2900);
  assert.equal(normalizeCLP('$ 3.990'), 3990);
});

test('sufijo k', () => {
  assert.equal(normalizeCLP('15k'), 15000);
  assert.equal(normalizeCLP('1.5k'), 1500);
});

test('lucas: N lucas = N × 1000 (regresión bug)', () => {
  assert.equal(normalizeCLP('2 lucas'), 2000);
  assert.equal(normalizeCLP('1 luca'), 1000);
  assert.equal(normalizeCLP('3 lucas'), 3000);
  assert.equal(normalizeCLP('1.5 lucas'), 1500);
});

test('número entero puro', () => {
  assert.equal(normalizeCLP('1500'), 1500);
  assert.equal(normalizeCLP('100'), 100);
});

test('rechaza ruido y montos inválidos', () => {
  assert.equal(normalizeCLP('50'), null);      // < 100, ambiguo
  assert.equal(normalizeCLP('2.5'), null);     // decimal real no soportado en CLP
  assert.equal(normalizeCLP('abc'), null);
  assert.equal(normalizeCLP(''), null);
});
