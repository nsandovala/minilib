'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';
import { getHealthEntries } from '@/core/queries/entry-queries';
import { HEALTH_AGENT } from '@/core/card-agents';

export default function HealthPage() {
  return (
    <FilteredEntriesPage
      title="Salud"
      description="Remedios, controles y citas."
      filter={getHealthEntries}
      searchPlaceholder="Buscar salud..."
      emptyLabel={HEALTH_AGENT.ui.emptyState.title}
      emptyHint={HEALTH_AGENT.ui.emptyState.body}
    />
  );
}
