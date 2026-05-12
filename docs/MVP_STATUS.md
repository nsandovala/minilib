# MVP Status

## DONE
- Auth Clerk funcionando
- Neon sync funcionando
- Finanzas iniciales
- UI calm dashboard
- smart parser
- calendar parser
- grouped cards
- cloud auth
- cloud sync
- neon db
- auth-first homepage
- premium signed-out welcome screen
- human-readable expanded card detail
- deterministic purchase and household list parsing
- home refined as calm daily-life notebook
- per-type card rendering on home
- structured shopping_list entry type with persistent ChecklistItem records (Dexie v5/v6)
- interactive per-item toggle (checked state persists, syncs to cloud)
- sortOrder field: items maintain stable display order
- soft-delete: item deletions propagate across devices via deletedAt timestamp
- progress label (0/3 listos → shopping → Completado) + aggregate progress bar on Purchases page
- checklist items synced via dedicated cloud table (checklist_items in Neon, pushed via db:push)
- Purchases page: shopping summary card (listas, ítems, % completado) + interactive lists
- Shopping checklist metadata (metadata jsonb in entries)
- Deterministic RADAR parser with `parseEntryIntent`
- Item-level completion persisted in metadata
- **Card ordering**: pending first, done last, pinned before normal, urgent before normal, date ascending
- **Card editing**: inline text edit with re-parsing and Dexie update
- **Clean shopping parser**: intro phrases stripped before item extraction
- **Completed cards visually dimmed** (0.45 opacity)
- **list_builder cognitive agent**: deterministic shopping-list builder with category classification (`src/core/agents/list-builder-agent.ts`)
- **Real shopping item persistence**: `toggleShoppingItem()` in `src/db/entries.ts` atomically updates `metadata.items[].checked`, recalculates progress, sets dirty flag, and reflects instantly via `useLiveQuery`
- **CLP parser**: `normalizeCLP()` en `src/lib/money.ts` soporta puntos como separador de miles (`2.900` → 2900), `$`, `k`, `lucas`
- **Item-level prices**: `list-builder-agent` extrae precios de ítems (`pan 2.900` → amount: 2900) y cantidades/unidades
- **Shopping totals**: `progress.totalEstimated` y `progress.totalChecked` calculados automáticamente
- **Finance bridge**: al marcar lista como completada se crea entrada `payment` con monto total, deduplicada por tag `from_shopping:{localId}`
- **Purchases UI**: precios por ítem, total estimado/comprado en resumen y tarjetas

## IN PROGRESS
- radar agent enhancements
- conflict resolution
- reminders

## Planned Cognitive Agents
- calm_parser
- radar
- ~~list_builder~~ → **DONE**
- finance_parser
- calendar_parser
- docs_guardian
- orchestrator

## FUTURE
- HEO integrations
- family sync
- voice capture
- google calendar
- google photos

> **IMPORTANT RULE:**
> Every major implementation must update the docs automatically.
> Documentation is mandatory.
> Do not skip docs updates.
