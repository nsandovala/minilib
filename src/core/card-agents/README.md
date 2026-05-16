# Card Agent Config Layer

Lightweight TypeScript config layer for internal card agents in Liev / minilib.
Each agent encodes classification hints, priority rules, UI copy, and surface
placement for one entry type. **Read-only — never mutates entry data.**

---

## Architecture

```
src/core/card-agents/
  types.ts          — CardAgentConfig, CardSurface, CardAgentResolution interfaces
  note.agent.ts     — config for type 'note'
  payment.agent.ts  — config for type 'payment'
  pet.agent.ts      — config for type 'pet'
  shopping.agent.ts — config for type 'shopping_list'
  health.agent.ts   — config for types 'health' and 'appointment'
  task.agent.ts     — config for types 'task' and 'reminder'
  index.ts          — registry + resolver functions
```

Each `*.agent.ts` file is a plain `satisfies CardAgentConfig` object with a
YAML-equivalent comment block at the top showing the structure as if it were a
YAML config file.

---

## What each agent defines

| Field | Purpose |
|---|---|
| `id` / `type` | Identity; `type` can be `string \| string[]` (health covers health + appointment) |
| `surfaces.primary` | Home surface for this entry type |
| `surfaces.secondary` | Additional surfaces (e.g. `home`) — emitted only for pending entries with date or amount |
| `classification.signals` | Keywords/patterns the parser watches for (documentation only) |
| `classification.negativeSignals` | Phrases that should block this type (documentation only) |
| `classification.confidenceThreshold` | Mirrors the normalizer threshold (documentation only) |
| `classification.longFormGuard` | `true` on note — documents the long-text override |
| `priority.boostConditions` | Human-readable boost descriptions (documentation only) |
| `priority.suppressConditions` | Human-readable suppress descriptions (documentation only) |
| `ui.label` | Display label shown in the type pill on each card |
| `ui.calmExplanation` | Why Liev surfaced this entry ("Pago pendiente. Lo puse arriba por costo de olvido.") |
| `ui.emptyState.title` | Empty state heading for the section page |
| `ui.emptyState.body` | Empty state body for the section page |
| `ui.correctionHint` | Guidance shown when a user wants to reclassify |
| `correction.allowedTargetTypes` | Types a user can manually reassign this entry to |

---

## Resolver API (`index.ts`)

```typescript
// Returns display/surface hints for an already-classified entry. Never reclassifies.
resolveCardAgent(entry: TimelineEntry): CardAgentResolution

// Convenience — returns only the primary surface.
resolveSurfaceForEntry(entry: TimelineEntry): CardSurface

// Returns the agent config for a given entry type string, or undefined.
getAgentForType(type: string): CardAgentConfig | undefined
```

`resolveCardAgent` returns:
- `surface` — primary surface
- `allSurfaces` — primary + secondary (secondary only when entry is pending AND has date or amount)
- `calmExplanation` — the agent's calm reason string
- `deprioritized` — `true` when `entry.done`
- `label` — the agent's display label

---

## Current wiring status (as of 2026-05-16)

### ✅ Actively wired

| Field | Where |
|---|---|
| `ui.label` | `TimelineView.tsx` type pill · `NextBestAction.tsx` type chip |
| `ui.emptyState.title` | `/notes`, `/payments`, `/pets`, `/health`, `/todos`, `/purchases` pages |
| `ui.emptyState.body` | Same 6 pages |

### ⏳ Defined in resolver, not yet consumed downstream

| Field | Status | Next step |
|---|---|---|
| `ui.calmExplanation` | Returned by `resolveCardAgent()` but nothing reads it | Wire into expanded card view (`DetailLine` "Qué entendí" blocks in `TimelineView.tsx` ~line 908) — replaces the current hardcoded strings, low effort |
| `surfaces.primary` / `.secondary` | Computed correctly in `resolveCardAgent()` | No consumer yet; would power cross-surface pinning or smart navigation |
| `resolveCardAgent()` / `resolveSurfaceForEntry()` | Exported but never called from UI | Ready to use when surface-routing or calm explanation feature lands |

### 📋 Config-only documentation (no UI target yet)

| Field | Note |
|---|---|
| `classification.*` | Upstream parser metadata — actual classification happens in `normalizer-agent.ts` |
| `priority.*` | Conceptual docs — actual scoring in `src/core/priority/priority-score.ts` |
| `ui.correctionHint` | Needs reclassification UI skeleton first (card menu → "Mover a...") |
| `correction.allowedTargetTypes` | Would populate a "Mover a" dropdown — no UI affordance yet |

---

## Pending work (agreed scope, not yet implemented)

1. **`ui.calmExplanation` in expanded card view**
   Wire `resolveCardAgent(entry).calmExplanation` into the `DetailLine` "Qué entendí"
   row in `TimelineView.tsx`. This replaces the current hardcoded per-type strings
   (`'Cuidado de mascota'`, `'Pago pendiente'`, `'Nota guardada'`, etc.).

2. **Reclassification UI** (larger feature)
   - Add a "Mover a…" option in the card action menu
   - Read `getAgentForType(entry.type).correction.allowedTargetTypes` to populate options
   - Show `ui.correctionHint` as the contextual explanation
   - Call `reparseAndUpdateEntry` with user-selected type override

---

## How to add a new agent

1. Create `src/core/card-agents/your-type.agent.ts` — copy an existing agent as template
2. Add the YAML-equivalent comment block at the top
3. Export the const with `satisfies CardAgentConfig`
4. Register it in `index.ts` → `ALL_AGENTS` array
5. Add tests in `tests/card-agents.test.mjs`

The `type` field in `CardAgentConfig` can be `string | string[]` if one agent
covers multiple entry types (see `HEALTH_AGENT` covering `'health'` and `'appointment'`).
