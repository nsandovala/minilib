'use client';

import FilteredEntriesPage from '@/components/entries/FilteredEntriesPage';
import { getPaymentEntries } from '@/core/queries/entry-queries';
import { TASK_AGENT } from '@/core/card-agents';

export default function TodosPage() {
  return (
    <FilteredEntriesPage
      title="Pagos"
      description="Vista legacy conectada al nuevo filtro de pagos del MVP."
      filter={getPaymentEntries}
      searchPlaceholder="Buscar pagos..."
      emptyLabel={TASK_AGENT.ui.emptyState.title}
      emptyHint={TASK_AGENT.ui.emptyState.body}
    />
  );
}
