'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';

export default function MedsPage() {
  return (
    <FilteredEntriesPage
      title="Salud"
      types={['health']}
      searchPlaceholder="Buscar salud..."
      emptyLabel="No hay eventos de salud"
      emptyHint="Los remedios, síntomas y seguimientos aparecerán aquí."
    />
  );
}
