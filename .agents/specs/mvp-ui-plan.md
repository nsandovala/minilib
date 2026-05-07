# MiniLib/Liev MVP UI Plan

## Product Frame

MiniLib/Liev is an offline-first daily-life notebook.
It is not a chatbot, not a dashboard, and not a productivity machine.
The UI should feel calm, warm, direct, and useful in everyday situations.

## Visual Direction v0.1

- Matte dark base with low contrast transitions
- Snow-white primary text
- Skin/sand accents for warmth and human tone
- Subtle glass only where it improves hierarchy
- Blue reserved for primary actions
- Red reserved for real danger or destructive actions
- Avoid grid-heavy, mathematical, or cyberpunk backgrounds

## Information Architecture

## Home

- Universal input
- Quick chips: Compra, Pago, Salud, Mascota, Casa
- Daily summary: Hoy, Pendientes, Gastos
- Compact timeline with reduced visual weight

## Purchases

- Entries related to shopping, household, groceries, supermarket, market, home items
- Show amount when available
- Compact list only

## Payments

- Payment entries only
- Show paid/pending through existing done state
- Show amount and due date when available

## Health

- Health and appointment entries
- Medication, time, controls, appointments
- No diagnosis UI

## Pets

- Pet entries only
- Food, vet, vaccines, expenses

## Notes

- Notes only
- Quick ideas and text notes

## Data Rules

- `entries` remains the single source of truth
- Screen filtering must use helpers from `src/core/queries`
- UI consumes core; core does not depend on UI
- No mocks, fake widgets, cloud services, auth, or extra stores

## UI Components

- `UniversalInput`
  - Human placeholder copy
  - Helper text for real-life examples
  - Quick category chips that prefill the input

- `TimelineView`
  - More compact cards
  - Show amount chips when present
  - Keep direct completion and deletion actions

- `FilteredEntriesPage`
  - Reusable shell for purchases, payments, health, and pets
  - Shared search, summary, empty state

- `BottomNav`
  - Six real destinations only
  - Softer matte glass treatment

## Delivery Criteria

- `npm run typecheck` passes
- `npm run build` passes
- Interface feels warmer, calmer, and less dashboard-like
