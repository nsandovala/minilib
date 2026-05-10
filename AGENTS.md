# Agent System

This project uses an agent-based orchestration system defined in the `agents/` directory.

## Commands

| Command | Description |
|---------|-------------|
| scaffold | Scaffold new components or features |
| validate-db | Validate database schema and integrity |
| review | Run code review checks |
| test-gen | Generate tests |
| release | Prepare a release |

## Agents

| Agent | Role | Path |
|-------|------|------|
| orchestrator | Route commands to specialized agents | `agents/orchestrator/router.py` |

## Rules

All agents must follow the global rules defined in [`agents/.rules`](agents/.rules).

## Product Context

Before proposing or implementing product-facing changes, review [`docs/LIEV_PRODUCT_CONTEXT.md`](docs/LIEV_PRODUCT_CONTEXT.md).

This file defines Liev's positioning, product promise, UX constraints, and the decision rule that every change must reduce user cognitive load.

## Architecture

**Hybrid offline-first PWA** — local IndexedDB (Dexie) is the primary store; cloud (Neon PostgreSQL via Drizzle) is for sync/backup.

| Layer | Technology | Path |
|-------|-----------|------|
| Local DB | Dexie.js (IndexedDB, v3 schema with `localId` + `syncedAt`) | `src/db/index.ts` |
| Cloud DB | Drizzle ORM + Neon PostgreSQL | `src/db/cloud/` |
| Auth | Clerk (`@clerk/nextjs`) | `src/middleware.ts` |
| Sync API | POST `/api/sync/push`, GET `/api/sync/pull` | `src/app/api/sync/` |
| Client sync | Pull-first then push, guarded by `navigator.onLine` | `src/lib/sync/` |
| Core agents | Parser, normalizer, safety, timeline, query, insights | `src/core/agents/` |
| UI | Next.js 14 App Router, all pages are `'use client'` | `src/app/` |

**Data flow**: User types in `UniversalInput` → core agents parse/normalize → saved to Dexie `entries` table → background sync pushes to cloud when online.

## Developer Commands

```bash
npm run dev        # Next.js dev server
npm run typecheck  # tsc --noEmit (run after every code change)
npm run build      # Production build
npm run lint       # Next.js lint
npm run db:push    # Push Drizzle schema to Neon (requires .env)
npm run db:studio  # Open Drizzle Studio
```

**Order**: `lint` → `typecheck` → `build`. Always run `npm run typecheck` after code changes.

## Important Conventions

- **Commit messages in Spanish** — short, descriptive
- **No commits without user approval**
- **No changes to `package.json`, `package-lock.json`, or `next.config.mjs` unless explicitly allowed**
- **Core logic in `src/core/` — never modify without a spec**
- **No database migrations without explicit user approval**
- **No changes to `.env*` or cloud config without explicit user approval**
- **Path alias**: `@/*` → `./src/*`
- **TypeScript strict mode** enabled

## Testing

No test framework or tests exist yet. The `test-gen` agent command is available but unconfigured.

## Deployment

Target: Vercel (`.vercel` in `.gitignore`, Next.js project). PWA requires production build for service worker (`next-pwa` disabled in dev).
