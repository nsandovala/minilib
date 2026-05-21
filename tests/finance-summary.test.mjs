import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFinanceSummary } from '../src/core/finance/summary.ts';

let seq = 0;

function makeEntry(overrides = {}) {
  seq += 1;
  return {
    id: seq,
    localId: `finance-${seq}`,
    type: 'payment',
    title: 'Movimiento',
    text: 'Movimiento',
    date: null,
    time: null,
    tags: ['payment'],
    done: false,
    amount: 0,
    metadata: null,
    createdAt: new Date('2026-05-18T10:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

test('pagado + pendiente suma expenseTotal', () => {
  const summary = computeFinanceSummary([
    makeEntry({ text: 'Pagar luz', amount: 20000, done: true }),
    makeEntry({ text: 'Compra feria', amount: 15000, done: false }),
  ]);

  assert.equal(summary.expenseTotal, summary.paidExpenseTotal + summary.pendingExpenseTotal);
  assert.equal(summary.expenseTotal, 35000);
});

test('availableProjected = incomeTotal - expenseTotal', () => {
  const summary = computeFinanceSummary([
    makeEntry({ text: 'Ingreso sueldo', title: 'Ingreso sueldo', amount: 1000000 }),
    makeEntry({ text: 'Pagar internet', amount: 35000 }),
    makeEntry({ text: 'Compra feria', amount: 15000 }),
  ]);

  assert.equal(summary.availableProjected, summary.incomeTotal - summary.expenseTotal);
  assert.equal(summary.availableProjected, 950000);
});

test('pending expense se cuenta correctamente', () => {
  const summary = computeFinanceSummary([
    makeEntry({ text: 'Pagar agua', amount: 18000, done: false }),
    makeEntry({ text: 'Pagar luz', amount: 22000, done: true }),
  ]);

  assert.equal(summary.pendingExpenseTotal, 18000);
});

test('paid expense se cuenta correctamente', () => {
  const summary = computeFinanceSummary([
    makeEntry({ text: 'Pagar gas', amount: 12000, done: true }),
    makeEntry({ text: 'Compra súper', amount: 9000, done: false }),
  ]);

  assert.equal(summary.paidExpenseTotal, 12000);
});

test('income no se cuenta como expense', () => {
  const summary = computeFinanceSummary([
    makeEntry({ text: 'Ingreso venta', title: 'Ingreso venta', amount: 45000, done: true }),
    makeEntry({ text: 'Pagar internet', amount: 25000, done: false }),
  ]);

  assert.equal(summary.incomeTotal, 45000);
  assert.equal(summary.expenseTotal, 25000);
  assert.equal(summary.pendingIncomeTotal, 0);
  assert.equal(summary.resolvedIncomeTotal, 45000);
});
