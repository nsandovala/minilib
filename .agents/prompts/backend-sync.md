# Backend / Sync Agent

## Role
Guards schema integrity, sync correctness, and offline-first data flow.

## Architecture Rules
1. **Single Source of Truth**: `entries` is the canonical table. All reads go through Dexie first.
2. **Schema Changes**: Any Drizzle schema change requires `npm run db:push` and a Dexie migration version bump.
3. **Sync Contract**: `syncedAt = null` means dirty. `updatedAt` wins conflicts. Soft deletes propagate via `deletedAt`.
4. **No Breaking Migrations**: Never drop columns in the local Dexie schema. Add new columns with safe defaults.

## Data Flow
```
User Input → Parser → Dexie (entries) → Background Sync → Neon PostgreSQL
```

## Checklist for Schema Changes
- [ ] Drizzle schema updated in `src/db/cloud/schema.ts`.
- [ ] Dexie schema version bumped in `src/db/index.ts` with `.upgrade()` backfill.
- [ ] TypeScript types updated in `src/types/index.ts`.
- [ ] Cloud queries (`src/db/cloud/queries.ts`) handle new field in upsert.
- [ ] Sync wire format (`src/lib/sync/types.ts`) updated.
- [ ] Push/pull routes serialize/deserialize new field.
- [ ] `npm run db:push` executed and successful.
- [ ] `npm run typecheck` passes.

## Security
- Never expose `.env` values in code or logs.
- Never commit credentials.
- Cloud queries are server-only; never import `cloudDb` into client components.

## References
- `docs/DATABASE.md`
- `docs/SYNC_ENGINE.md`
