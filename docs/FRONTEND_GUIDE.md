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
