# RADAR Agent

## Vision
The RADAR agent operates as an ambient intelligence layer that constantly analyzes user input and stored data to provide proactive value.

## Core Capabilities
- **Detect Ideas**: Identify and categorize free-form thoughts into actionable ideas.
- **Detect Incomplete Tasks**: Find lingering to-dos or open loops.
- **Detect Projects**: Recognize themes across multiple entries that suggest a larger project.
- **Suggest Next Steps**: Propose logical actions based on current context.
- **Detect Paused/Reactivable Items**: Surface older entries that might be relevant again.
- **Micro-Insights**: Deliver small, high-value observations about user patterns.

## IMPORTANT: Architecture Philosophy
**RADAR first = deterministic**
**LLM second = enhancement layer**

The system must **not** depend entirely on AI. Deterministic rules, regex parsing, and metadata analysis form the foundation of RADAR. LLMs are only used to enhance, summarize, or enrich the data when deterministic methods have reached their limits.

## UX Output Rule
RADAR can detect rich metadata internally, but user-facing cards should not sound analytical or technical.

Preferred detail labels in Liev:
- `Qué entendí`
- `Cuándo`
- `Monto`
- `Tipo`
- `Próximo paso`
- `Detalle original`

Avoid exposing internal/debug-style labels such as:
- prioridad
- categoría
- lectura
- relación
- contexto

The user should feel understood, not inspected.

## Deterministic List Parsing
RADAR-compatible parsing recognizes grocery and household lists from comma-separated input.

Examples:
- `leche, yogurt, cereal, pan`
- `frutas, verduras, lácteos, artículos de aseo para la casa`
- `comprar en el super, leche, huevos, mantequilla, pan, bebidas, paltas, tomate`

When `isListLike` is true, the normalizer emits `type: 'shopping_list'` and the entry creation flow seeds structured `ChecklistItem` records in Dexie. Each item is independently toggleable and syncs to the cloud `checklist_items` table.

New behavior (metadata-first):
- `metadata.listKind = 'shopping'`
- `metadata.storeType` = `supermercado | feria | farmacia | otro`
- `metadata.items[]` = `{ id, label, category, checked, quantity?, estimatedPrice? }`
- `metadata.progress` = `{ total, checked }`

Deterministic outputs:
- `checklistItems[]`: seed labels for Dexie records (backwards compat)
- `listGroups[]`: detected grocery/household groups
- `detectedTags[]`: semantic tags (frutas, lácteos, aseo hogar…)
- `metadata`: canonical structured state for shopping lists

## Item Categories (Deterministic)
The parser classifies each shopping item into a deterministic category:
- **lácteos**: leche, yogurt, yogur, queso, mantequilla
- **huevos/despensa**: huevos, arroz, fideos, azúcar, harina, aceite, pan integral
- **frutas/verduras**: tomate, palta, paltas, lechuga, cebolla, papas, frutas, verduras, plátano, limones
- **panadería**: pan, hallulla, marraqueta, pan batido, colizas
- **aseo**: confort, papel, cloro, detergente, lavaloza
- **bebestibles**: bebida, bebidas, jugo, agua  
- **otros**: fallback

## Intro Cleaning
Before splitting comma-separated input into items, the parser strips introductory phrases so the checklist contains only real products:
- `comprar en el super`
- `lista de compras`
- `necesito comprar`
- `traer de el super`
- `ir a comprar`
- `supermercado`
- `en el super`

After cleaning, the remaining tokens are split by commas and classified into categories.

## Store Detection
Introductory phrases are stripped and the destination is detected:
- `supermercado`, `super`, `en el super` → `supermercado`
- `feria` → `feria`
- `farmacia` → `farmacia`
- default → `otro`

## Shopping Stage
Derived dynamically from item state — not stored:
- `pending`: 0 items checked
- `shopping`: some items checked (in progress)
- `completed`: all items checked

## Future Layers
Inventory tracking, recurring basket intelligence, and estimated pricing remain future layers built on top of the structured checklist foundation.

## Planned Cognitive Agents
- calm_parser
- radar
- list_builder
- finance_parser
- calendar_parser
- docs_guardian
