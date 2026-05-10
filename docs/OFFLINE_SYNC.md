# Offline Sync

## Overview
Liev is offline-first. All reads and writes go to Dexie (IndexedDB) immediately. The sync engine pushes/pulls changes to Neon (PostgreSQL via Drizzle) in the background, only when the user is authenticated and online.

## Data Flow

```
User action
  → Dexie (instant, offline-safe)
  → syncedAt = null (dirty flag)

App init / focus
  → sync() called
  → pull (server → local merge)
  → push (local dirty → server)
  → syncedAt = now (clean)
```

## Tables Synced

### Entries (`entries`)
- Conflict strategy: last-write-wins on `updatedAt`.
- New server records are added locally; newer server records overwrite local.

### Checklist Items (`checklist_items`)
- Each item is independently synced by its `localId` UUID.
- Conflict strategy: last-write-wins on `updatedAt`.
- Items are tied to a parent entry via `localEntryId`.
- Checked/unchecked state persists across devices.

## Dirty Flag
- `syncedAt = null`: record created locally, never pushed.
- `syncedAt < updatedAt`: record updated since last push.
- Dirty records are collected at push time and stamped `syncedAt = now` on success.

## Push Payload
```json
{
  "entries": [...EntryPayload],
  "checklistItems": [...ChecklistItemPayload]
}
```

## Pull Response
```json
{
  "entries": [...EntryPayload],
  "checklistItems": [...ChecklistItemPayload]
}
```

## Guards
- `_running` mutex: prevents concurrent sync runs.
- `navigator.onLine` check: skips sync when offline (no silent failure).
- Auth check: server routes return 401 if not signed in; client skips silently.

## Cloud Schema
Managed via Drizzle Kit. Apply schema changes with:
```
npm run db:push
```

## Conflict Resolution
Currently last-write-wins based on `updatedAt`. The server-side record takes precedence during pull if its `updatedAt` is newer than the local record's.
