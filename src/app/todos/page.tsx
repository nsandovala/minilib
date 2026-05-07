'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';

export default function TodosPage() {
  return (
    <FilteredEntriesPage
      title="Tareas"
      types={['task', 'reminder', 'payment']}
      searchPlaceholder="Buscar tareas..."
      emptyLabel="No hay tareas activas"
      emptyHint="Agrega tareas, recordatorios o pagos desde la timeline principal."
    />
  );
}
