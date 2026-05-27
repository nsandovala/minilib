import type { TimelineEntry } from '@/types';

export interface FinanceSummary {
  incomeTotal: number;
  expenseTotal: number;
  availableProjected: number;
  pendingExpenseTotal: number;
  paidExpenseTotal: number;
  pendingIncomeTotal: number;
  resolvedIncomeTotal: number;
}

function getEntryAmount(entry: TimelineEntry): number {
  return typeof entry.amount === 'number' && !Number.isNaN(entry.amount) ? entry.amount : 0;
}

function getFinancialDirection(entry: TimelineEntry): 'income' | 'expense' {
  return /\b(ingreso|sueldo|me\s+pagaron|pagaron|venta|transferencia\s+recibida|entró|entro|depósito|deposito)\b/i.test(
    `${entry.text} ${entry.title}`,
  )
    ? 'income'
    : 'expense';
}

export function computeFinanceSummary(entries: TimelineEntry[]): FinanceSummary {
  const summary: FinanceSummary = {
    incomeTotal: 0,
    expenseTotal: 0,
    availableProjected: 0,
    pendingExpenseTotal: 0,
    paidExpenseTotal: 0,
    pendingIncomeTotal: 0,
    resolvedIncomeTotal: 0,
  };

  for (const entry of entries) {
    const isFinancialEntry =
      entry.type === 'payment' ||
      entry.tags.includes('manual') ||
      entry.tags.includes('income') ||
      entry.tags.includes('expense');
    if (!isFinancialEntry) continue;

    const amount = getEntryAmount(entry);
    if (amount <= 0) continue;

    if (getFinancialDirection(entry) === 'income') {
      summary.incomeTotal += amount;
      if (entry.done) summary.resolvedIncomeTotal += amount;
      else summary.pendingIncomeTotal += amount;
      continue;
    }

    summary.expenseTotal += amount;
    if (entry.done) summary.paidExpenseTotal += amount;
    else summary.pendingExpenseTotal += amount;
  }

  summary.availableProjected = summary.incomeTotal - summary.expenseTotal;

  return summary;
}
