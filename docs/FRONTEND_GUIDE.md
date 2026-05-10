# Frontend Guide

## Overview
Guidelines for developing the Next.js/React frontend.

## Product Context
- Review [`docs/LIEV_PRODUCT_CONTEXT.md`](./LIEV_PRODUCT_CONTEXT.md) before making product-facing UI decisions.
- Liev should feel calm, minimal, premium, and cognitively light.
- Do not surface AI complexity, AMON ecosystem modules, or chatbot-first UX in the MVP.
- Prefer fewer visible features and clearer cards over feature density.
- If a UI change does not reduce friction or mental load, it should not be implemented.
- Signed-out surfaces should feel like a quiet product landing, not a raw auth gate.
- Expanded card details should use human labels such as `Qué entendí`, `Cuándo`, `Monto`, `Tipo`, `Próximo paso` y `Detalle original`.
- Avoid debug-like metadata labels or exposing internal interpretation terminology in the interface.
- The home hierarchy should stay simple: brand, input, small summary, category chips, grouped entry list.
- Purchase lists should render as calm checklist cards rather than raw text blobs whenever comma-separated items are detected.
- Collapsed cards should stay lightweight: type pill, title, and only the most relevant date/time/money.

## Core Principles
- **Offline-First**: All UI interactions should read from and write to the local Dexie database immediately. Never block the UI waiting for a network request to save data.
- **Optimistic Updates**: Assume operations will succeed. Apply changes locally and let the Sync Engine handle eventual consistency.
- **Responsive Design**: Ensure mobile-first, responsive layouts.
- **Accessibility**: Follow WCAG guidelines for all interactive elements.

## State Management
- Local database state is managed via Dexie hooks (`useLiveQuery`).
- Ephemeral UI state (modals, toggles) is managed via React `useState` or Context.

## Component Structure
- Favor Server Components for static layouts and initial data fetching.
- Use Client Components for interactive elements and any component that hooks into Dexie.

## Card Ordering
Timeline groups remain `Hoy`, `Próximos días`, `Sin fecha`. Inside each group, entries are sorted by:
1. **Pending first** — completed cards sink to the bottom.
2. **Pinned first** — favorited cards float above normal ones.
3. **Priority** — urgent > important > normal.
4. **Date ascending** — earlier dates come first.
5. **Time ascending** — when dates match.
6. **Updated desc** — most recently touched as final tie-breaker.

## Card Editing
Every card supports inline editing:
- Click the pencil icon to enter edit mode.
- The raw text becomes an editable input.
- **Enter** saves; **Escape** cancels; **Blur** saves.
- On save, the text is re-parsed deterministically. `type`, `date`, `time`, `amount`, `tags`, and `metadata` are updated.
- For shopping lists, existing `checked` states are preserved by matching item labels.
- `syncedAt` is set to `null` so the next sync pushes the change.

## Visual States
- **Active cards**: full opacity, clean glass surface.
- **Completed cards**: reduced opacity (`0.45`) to visually recede without disappearing.
- **Pinned cards**: golden star indicator, sorted higher.
- **Urgent cards**: red priority dot.
- Keep visual complexity minimal; rely on opacity, subtle color, and spacing rather than borders or shadows.
