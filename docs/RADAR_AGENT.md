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

When `isListLike` is true, the normalizer emits `type: 'shopping_list'` and the entry creation flow seeds structured `ChecklistItem` records in Dexie. Each item is independently toggleable and syncs to the cloud `checklist_items` table.

Deterministic outputs:
- `checklistItems[]`: seed labels for Dexie records
- `listGroups[]`: detected grocery/household groups
- `detectedTags[]`: semantic tags (frutas, lácteos, aseo hogar…)

## Shopping Stage
Derived dynamically from item state — not stored:
- `pending`: 0 items checked
- `shopping`: some items checked (in progress)
- `completed`: all items checked

## Future Layers
Inventory tracking, recurring basket intelligence, and estimated pricing remain future layers built on top of the structured checklist foundation.
