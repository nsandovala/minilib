'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';
import { getPetEntries } from '@/core/queries/entry-queries';

export default function PetsPage() {
  return (
    <FilteredEntriesPage
      title="Mascotas"
      description="Comida, vacunas y pendientes."
      filter={getPetEntries}
      searchPlaceholder="Buscar mascotas..."
      emptyLabel="No hay registros de mascotas"
      emptyHint="Anota comida, vet o vacunas aquí."
    />
  );
}
