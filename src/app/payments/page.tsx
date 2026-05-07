'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';
import { getPaymentEntries } from '@/core/queries/entry-queries';

export default function PaymentsPage() {
  return (
    <FilteredEntriesPage
      title="Pagos"
      description="Cuentas y servicios pendientes."
      filter={getPaymentEntries}
      searchPlaceholder="Buscar pagos..."
      emptyLabel="No hay pagos"
      emptyHint="Anota cuentas o servicios para verlos aquí."
    />
  );
}
