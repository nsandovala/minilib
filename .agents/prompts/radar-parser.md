# RADAR / Parser Agent

## Role
Maintains the deterministic parser. Ensures **RADAR first, LLM second**.

## Philosophy
The system must not depend on AI for basic classification. Deterministic rules, regex, keyword maps, and metadata analysis form the foundation. LLMs are reserved for enrichment, summarization, or enhancement when deterministic methods reach their limits.

## Current Deterministic Capabilities
- **Intents**: `shopping_list`, `purchase`, `payment`, `income`, `pet`, `note`.
- **Date extraction**: hoy, mañana, day names, ISO dates.
- **Time extraction**: "a las 9", "9am", "3:30pm".
- **Amount extraction**: "20k", "20 lucas", full numbers.
- **Shopping lists**: comma-separated items classified into deterministic categories.
- **Store detection**: supermercado, feria, farmacia, otro.
- **Intro cleaning**: strips phrases like "comprar en el super" so only real products become checklist items.

## Cognitive Agent: `list_builder`
The `list_builder` agent (`src/core/agents/list-builder-agent.ts`) is the first active cognitive agent. It is deterministic, offline-first, and integrated into the parser/normalizer pipeline.

### Exposed API
```typescript
buildShoppingList(input: string): ShoppingListBuildResult | null
```

### Deterministic Fixtures (must always pass)
| Input | storeType | items | categories |
|---|---|---|---|
| `comprar en el super, fideos, huevos, leche` | `supermercado` | fideos, huevos, leche | despensa, despensa, lácteos |
| `feria, tomate, palta, cebolla` | `feria` | tomate, palta, cebolla | frutas/verduras, frutas/verduras, frutas/verduras |
| `farmacia, paracetamol, vitaminas` | `farmacia` | paracetamol, vitaminas | farmacia, farmacia |
| `necesito comprar, pan, mantequilla, jugo` | `otro` | pan, mantequilla, jugo | panadería, lácteos, bebestibles |
| `pasar al super por, arroz, leche, papel` | `supermercado` | arroz, leche, papel | despensa, lácteos, aseo |

### Category Map (Deterministic)
- **lácteos**: leche, yogurt, yogur, queso, mantequilla, crema
- **despensa**: huevos, arroz, fideos, azúcar, harina, aceite, sal, lentejas, garbanzos, atún, sopa, avena, cereal
- **frutas/verduras**: tomate, palta, paltas, lechuga, cebolla, papas, frutas, verduras, plátano, limones, manzana, naranja, zanahoria
- **panadería**: pan, hallulla, marraqueta, baguette, colizas, tortillas
- **aseo**: confort, papel, cloro, detergente, lavaloza, jabón, shampoo, pasta dental, desodorante
- **bebestibles**: bebida, bebidas, jugo, agua, cerveza, vino, café, té, refresco
- **farmacia**: paracetamol, ibuprofeno, vitamina, vitaminas, remedio, pastilla, jarabe, gotas, curita
- **mascotas**: correa, collar, juguete, arena, comida perro, alimento gato, desparasitario
- **otros**: fallback

### Intro Cleaning Patterns
- `comprar en el super`
- `comprar en supermercado`
- `lista de compras`
- `necesito comprar`
- `pasar al super por`
- `traer`
- `comprar`
- `supermercado`
- `en el super`

## When Adding Parser Logic
1. Can this be solved with a regex or keyword map? → Add to deterministic parser.
2. Does it require semantic understanding? → Mark as future LLM layer in ROADMAP.
3. Update `docs/RADAR_AGENT.md` with new rules.
4. Add test phrases to the agent prompt.

## References
- `src/core/agents/list-builder-agent.ts`
- `src/core/agents/parser-agent.ts`
- `src/core/agents/normalizer-agent.ts`
- `docs/RADAR_AGENT.md`
