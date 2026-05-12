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
- `metadata`: JSONB field for structured entry metadata. Used for shopping lists (`listKind: 'shopping'`) with `storeType`, `items` (array with `id`, `label`, `category`, `checked`, `quantity`, `estimatedPrice`), and `progress` (`total`, `checked`).

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

## Shopping List Metadata (New)
For MVP, shopping lists store their structured state inside `entries.metadata` as `ShoppingMetadata`:
- `listKind`: `"shopping"`
- `storeType`: `"supermercado" | "feria" | "farmacia" | "otro"`
- `items`: Array of objects:
  - `id`: UUID
  - `label`: string
  - `category`: deterministic category (`lácteos`, `despensa`, `frutas/verduras`, `panadería`, `aseo`, `bebestibles`, `farmacia`, `mascotas`, `otros`)
  - `checked`: boolean
  - `quantity?`: string
  - `estimatedPrice?`: number
- `progress`: `{ total: number; checked: number }`

This metadata is synced via the `entries` table (push/pull) and merged last-write-wins by `updatedAt`.

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
