# Database

## Drizzle Schema
Our remote database uses Drizzle ORM to define the schema. The schema is designed to mirror the local Dexie store while supporting multi-tenant user data.

## Entries Table
The primary table for storing user data.

Key Columns:
- `id`: The client-generated `localId` UUID — primary key across cloud and local.
- `userId`: Clerk user ID.
- `type`: Entry type. Includes `shopping_list` (structured list) as well as `note`, `task`, `payment`, `health`, `appointment`, `pet`, `reminder`.
- `syncedAt`: Timestamp of last successful sync (Dexie only — not stored in cloud).
- `checklistItems`: Legacy seed array in the entry; canonical item state lives in `checklist_items` table.
- `listItems`, `listGroups`, `detectedTags`: Deterministic metadata from the parser.
- `metadata`: JSONB field for structured entry metadata. Used for shopping lists (`listKind: 'shopping'`) with `storeType`, `items` (array with `id`, `label`, `category`, `checked`, `amount`, `quantity`, `unit`), and `progress` (`total`, `checked`, `totalEstimated`, `totalChecked`).

## Checklist Items Table
Separate table for structured per-item state within a `shopping_list` entry. Maintained for backwards compatibility; new shopping lists use `metadata` as the canonical source.

Local (Dexie v6/v7, table: `checklist_items`, indexes: `++id, &localId, localEntryId, checked, updatedAt, syncedAt`):
- `id`: Auto-increment local PK.
- `localId`: UUID — stable sync key.
- `localEntryId`: Parent entry's `localId`.
- `label`: Item text (e.g. "leche", "yogurt").
- `checked`: Boolean toggle state — persists across refresh and syncs.
- `category`: Optional grouping (`supermercado`, `farmacia`, `hogar`, `mascotas`).
- `sortOrder`: Integer position within the list (0-based). Enables ordered display.
- `createdAt`, `updatedAt`, `syncedAt`.
- `deletedAt`: Soft-delete timestamp. Null = active. Set when parent entry is deleted. Propagates to other devices via sync.

Cloud (Neon table: `checklist_items`, applied via `npm run db:push`):
- `id`: The item's `localId`.
- `entry_id`: Parent entry's `localId`.
- `user_id`: Clerk user ID.
- `label`, `checked`, `category`, `sort_order`, `created_at`, `updated_at`.
- `deleted_at`: Soft-delete — returned on pull so deletions propagate to all devices.

## Shopping List Metadata
Shopping lists store their structured state inside `entries.metadata` as `ShoppingMetadata`:
- `listKind`: `"shopping"`
- `storeType`: `"supermercado" | "feria" | "farmacia" | "otro"`
- `items`: Array of objects:
  - `id`: UUID
  - `label`: string
  - `category`: deterministic category (`lácteos`, `despensa`, `frutas/verduras`, `panadería`, `aseo`, `bebestibles`, `farmacia`, `mascotas`, `otros`)
  - `checked`: boolean
  - `amount?`: number (precio estimado del ítem, extraído de input como "pan 2.900")
  - `quantity?`: string
  - `unit?`: string
- `progress`:
  - `total`: número de ítems
  - `checked`: ítems marcados
  - `totalEstimated`: suma de `amount` de todos los ítems
  - `totalChecked`: suma de `amount` de ítems marcados

This metadata is synced via the `entries` table (push/pull) and merged last-write-wins by `updatedAt`.

## Shopping List Item Persistence
Item-level checked state lives inside `metadata.items[].checked`. Toggling an item is performed atomically via `toggleShoppingItem(entryId, itemId)` in `src/db/entries.ts`:

1. Reads the entry from Dexie.
2. Finds the item by UUID inside `metadata.items`.
3. Inverts `checked`, recalculates `progress` (`total`, `checked`, `totalEstimated`, `totalChecked`).
4. Writes updated `metadata` back to the entry.
5. Sets `updatedAt = now` and `syncedAt = null` (dirty flag).

Because the change is stored in Dexie, it is immediately reflected in any component using `useLiveQuery` (e.g., `useEntries`). No separate checklist table is required for metadata-first shopping lists. Legacy `checklist_items` records remain supported for backwards compatibility.

## CLP Parsing
The deterministic parser supports montos chilenos en lenguaje natural:
- `2.900` → 2900 (punto como separador de miles)
- `$12.500` → 12500
- `220.000` → 220000
- `15k` → 15000
- `2 lucas` → 2000
- `1500` → 1500

En contexto de listas de compras, los precios se extraen a nivel de ítem (ej. `pan 2.900` → ítem "pan" con `amount: 2900`). El total estimado de la lista se acumula en `metadata.progress.totalEstimated`.

## Finance Bridge
Cuando una lista de compras se marca como completada (`entry.done = true`), `toggleEntryDone` dispara `ensureShoppingListPayment`. Esta función crea automáticamente una entrada `type: 'payment'` con:
- Monto = `totalChecked` si existe, si no `totalEstimated`
- Tag `from_shopping:{localId}` para evitar duplicados
- Categoría `gasto cotidiano`

## Soft-Delete Behavior
When a parent entry is deleted, its checklist items are soft-deleted locally (`deletedAt = now, syncedAt = null`). The next push sends these to Neon. The next pull on any other device receives the items with `deletedAt` set and soft-deletes them locally.

## Dexie Migration History
- v1–v2: Legacy tables (no entries).
- v3: Entries table; adds `localId` UUID and `syncedAt`.
- v4: Adds `checklistItems`, `listItems`, `listGroups`, `detectedTags` fields to entries.
- v5: Adds `checklist_items` table; seeds `ChecklistItem` records from existing `entry.checklistItems` arrays.
- v6: Adds `updatedAt` index + backfills `sortOrder: 0` and `deletedAt: null` on all existing items.
- v7: Adds `metadata` field to entries (JSON object, defaults to `null`).

## Migrations
Schema is applied to Neon via `npm run db:push` (Drizzle Kit push). Run this after any cloud schema change.
