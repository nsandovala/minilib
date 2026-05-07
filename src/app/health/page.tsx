'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';
import { getHealthEntries } from '@/core/queries/entry-queries';

export default function HealthPage() {
  return (
    <FilteredEntriesPage
      title="Salud"
      description="Remedios, controles y citas."
      filter={getHealthEntries}
      searchPlaceholder="Buscar salud..."
      emptyLabel="No hay registros de salud"
      emptyHint="Los remedios y citas aparecerán aquí."
    />
  );
}
