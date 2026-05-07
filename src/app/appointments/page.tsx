'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';

export default function AppointmentsPage() {
  return (
    <FilteredEntriesPage
      title="Citas"
      types={['appointment']}
      searchPlaceholder="Buscar citas..."
      emptyLabel="No hay citas registradas"
      emptyHint="Las consultas y controles detectados por el parser viven aquí."
    />
  );
}
