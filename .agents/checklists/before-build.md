# Before Build Checklist

## Type Safety
- [ ] `npm run typecheck` passes.
- [ ] No `any` types introduced unnecessarily.
- [ ] New types exported from `src/types/index.ts` if reused across files.

## Database
- [ ] Dexie version is correct and migrations are safe.
- [ ] If Drizzle schema changed: `npm run db:push` already executed.
- [ ] No breaking column removals in local schema.

## Sync Wire Format
- [ ] `EntryPayload` and `ChecklistItemPayload` match what push/pull routes expect.
- [ ] New fields are serialized/deserialized correctly in `src/lib/sync/`.

## Dependencies
- [ ] No new packages added to `package.json` without explicit approval.
- [ ] No unused imports left in changed files.

## Build
- [ ] `npm run build` passes.
- [ ] PWA service worker generates without errors (`next-pwa`).
- [ ] No hydration mismatches in client components.

## Runtime Smoke Test
- [ ] Home page loads.
- [ ] Universal input accepts text and creates an entry.
- [ ] Entries appear in timeline.
- [ ] Sync indicator behaves correctly (if visible).
