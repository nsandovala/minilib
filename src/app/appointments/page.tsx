'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';
import { getHealthEntries } from '@/core/queries/entry-queries';

export default function AppointmentsPage() {
  return (
    <FilteredEntriesPage
      title="Salud"
      description="Vista legacy conectada al filtro combinado de salud y citas."
      filter={getHealthEntries}
      searchPlaceholder="Buscar citas o controles..."
      emptyLabel="No hay citas registradas"
      emptyHint="Las consultas, controles y recordatorios de salud viven aquí."
    />
  );
}
