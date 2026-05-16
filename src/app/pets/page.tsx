'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';
import { getPetEntries } from '@/core/queries/entry-queries';
import { PET_AGENT } from '@/core/card-agents';

export default function PetsPage() {
  return (
    <FilteredEntriesPage
      title="Mascotas"
      description="Comida, vacunas y pendientes."
      filter={getPetEntries}
      searchPlaceholder="Buscar mascotas..."
      emptyLabel={PET_AGENT.ui.emptyState.title}
      emptyHint={PET_AGENT.ui.emptyState.body}
    />
  );
}
