'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';
import { getPurchaseEntries } from '@/core/queries/entry-queries';

export default function PurchasesPage() {
  return (
    <FilteredEntriesPage
      title="Compras"
      description="Despensa, mercado, cosas para la casa."
      filter={getPurchaseEntries}
      searchPlaceholder="Buscar compras..."
      emptyLabel="No hay compras"
      emptyHint="Anota compras del súper o gastos del día."
    />
  );
}
