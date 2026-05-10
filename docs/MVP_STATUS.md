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

## IN PROGRESS
- radar agent enhancements
- conflict resolution
- reminders

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
