# Sync Engine

## Overview
The Sync Engine keeps the local Dexie (IndexedDB) database in sync with the remote Neon (PostgreSQL) database. All reads/writes go to Dexie immediately. Sync runs in the background after authentication.

## Tables Synced
| Table | Dexie dirty flag | Cloud table |
|---|---|---|
| `entries` | `syncedAt` on entry | `entries` |
| `checklist_items` | `syncedAt` on item | `checklist_items` |

## Metadata Sync
The `entries` table now includes a `metadata` JSONB column. Shopping lists store their full structured state (`items`, `progress`, `storeType`) inside `metadata`. This is treated as part of the entry payload:
- Push: `metadata` is serialized as-is and sent in `EntryPayload`.
- Pull: `metadata` is read from the cloud row and written directly into the local entry.
- Merge: last-write-wins on `updatedAt` at the entry level; item-level `checked` state is preserved by whichever device wrote last.

## Push Flow
1. Collect all `entries` where `!syncedAt` or `updatedAt > syncedAt`.
2. Collect all `checklist_items` where `!syncedAt` or `updatedAt > syncedAt` (includes soft-deleted items so deletions propagate).
3. POST `{ entries, checklistItems }` to `/api/sync/push`.
4. Server upserts both tables in Neon.
5. Client stamps `syncedAt = now` on all pushed records.

## Pull Flow
1. GET `/api/sync/pull`.
2. Server returns `{ entries, checklistItems }` for the authenticated user.
3. Client merges entries: last-write-wins on `updatedAt`. `metadata` is overwritten if the remote entry is newer.
4. Client merges checklist items via `upsertChecklistItemFromSync`: last-write-wins; if pulled item has `deletedAt`, local item is soft-deleted.

## Conflict Strategy
Last-write-wins based on `updatedAt`. Server record wins during pull if its `updatedAt` is newer than the local record. Because shopping list item state lives inside `entry.metadata`, toggling an item updates the entry's `updatedAt`, which naturally resolves conflicts at the entry level.

## Edit Flow
When a user edits a card inline:
1. The new text is re-parsed deterministically (`reparseAndUpdateEntry`).
2. `type`, `date`, `time`, `amount`, `tags`, and `metadata` are updated.
3. For shopping lists, existing `checked` states are preserved by matching item labels.
4. `updatedAt` is set to now and `syncedAt` to `null`, triggering a push on the next sync cycle.

## Soft-Delete
Checklist items are never hard-deleted locally. When a parent entry is deleted, its items are marked `deletedAt = now, syncedAt = null`. The next push sends these to the cloud. Other devices receive the deletion on next pull and soft-delete their local copy.

## Wire Format
```typescript
// Push body / Pull response
{
  entries: EntryPayload[];
  checklistItems: ChecklistItemPayload[];  // includes deletedAt field
}

// EntryPayload includes metadata
interface EntryPayload {
  // ...existing fields...
  metadata: ShoppingMetadata | null;
}
```

## Guards
- `_running` flag: prevents concurrent sync runs.
- `navigator.onLine`: skips sync when offline.
- Clerk auth: 401 from server routes causes silent client skip.

## Schema Management
Cloud schema managed by Drizzle Kit. Apply changes with:
```
npm run db:push
```
