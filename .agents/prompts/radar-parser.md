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

## Category Map (Deterministic)
- lácteos: leche, yogurt, yogur, queso, mantequilla
- huevos/despensa: huevos, arroz, fideos, azúcar, harina, aceite
- frutas/verduras: tomate, palta, paltas, lechuga, cebolla, papas
- panadería: pan, hallulla, marraqueta
- aseo: confort, papel, cloro, detergente, lavaloza
- bebestibles: bebida, bebidas, jugo, agua
- otros: fallback

## When Adding Parser Logic
1. Can this be solved with a regex or keyword map? → Add to deterministic parser.
2. Does it require semantic understanding? → Mark as future LLM layer in ROADMAP.
3. Update `docs/RADAR_AGENT.md` with new rules.
4. Add test phrases to the agent prompt.

## References
- `src/core/agents/parser-agent.ts`
- `src/core/agents/normalizer-agent.ts`
- `docs/RADAR_AGENT.md`
