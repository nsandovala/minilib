# Before Commit Checklist

## Code Quality
- [ ] `npm run typecheck` passes without errors.
- [ ] `npm run build` passes without errors.
- [ ] `npm run lint` passes (if available).
- [ ] No `console.log` left in production code (keep only guarded `process.env.NODE_ENV !== 'production'` logs).
- [ ] No secrets, API keys, or `.env` values committed.

## Logic Integrity
- [ ] Core logic lives in `src/core/`, not UI components.
- [ ] No duplicate state stores introduced.
- [ ] Dexie migration version bumped if schema changed.
- [ ] Cloud schema pushed (`npm run db:push`) if Drizzle schema changed.

## Sync Safety
- [ ] `syncedAt` is set to `null` on local mutations that need to propagate.
- [ ] `updatedAt` is updated on every mutation.
- [ ] Soft deletes use `deletedAt`, not hard deletion, for checklist items.

## Parser / RADAR
- [ ] Deterministic rules updated if new patterns added.
- [ ] New test phrases added to parser-agent docs.
- [ ] No LLM dependency introduced for basic classification.

## Docs
- [ ] `docs/MVP_STATUS.md` updated if feature status changed.
- [ ] Relevant technical docs updated (`DATABASE.md`, `SYNC_ENGINE.md`, `RADAR_AGENT.md`, `FRONTEND_GUIDE.md`).

## Commit Message
- [ ] Written in Spanish.
- [ ] Short and descriptive (imperative mood).
- [ ] Example: `Agrega toggle de items en metadata de shopping lists`
