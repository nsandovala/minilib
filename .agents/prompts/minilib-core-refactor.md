# MiniLib / Liev — Core Refactor

Actúa como CTO senior + product engineer.

## Contexto
MiniLib es una PWA offline-first con Next.js, TypeScript, Tailwind y Dexie/IndexedDB.

Queremos convertirla en una libreta viva contextual para la vida cotidiana.

No es una app de notas tradicional.
No es un chatbot.
No es un dashboard financiero.

Es una capa operacional cotidiana:
- pendientes
- gastos del hogar
- pagos
- salud
- mascotas
- citas
- notas rápidas

## Principio arquitectónico
Backend/data-first.

Aunque el MVP sea local/offline, IndexedDB debe tratarse como local event store.

La UI nunca debe contener lógica de negocio principal.

## Fuente única de verdad
`entries`.

No crear stores separados para notes/todos/meds/appointments si puede derivarse desde entries.

## Objetivo técnico
Crear agentes internos determinísticos:

- ParserAgent
- NormalizerAgent
- TimelineAgent
- QueryAgent
- SafetyAgent
- InsightsAgent
- Orchestrator

## Estructura deseada

src/core/agents/
  parser-agent.ts
  normalizer-agent.ts
  timeline-agent.ts
  query-agent.ts
  safety-agent.ts
  insights-agent.ts
  orchestrator.ts

src/core/queries/
  entry-queries.ts

src/core/timeline/
  group-entries.ts

src/core/insights/
  micro-insights.ts

## Reglas
- No mocks.
- No APIs externas.
- No OpenAI todavía.
- No Claude API.
- No backend cloud.
- No login.
- No duplicar estado.
- No romper PWA.
- No cambiar UI más de lo necesario en esta fase.

## Tareas
1. Mover la lógica de `context-parser` hacia `ParserAgent`.
2. Crear `NormalizerAgent` para:
   - normalizar montos como 20k, 20 lucas, 20.000
   - normalizar fechas
   - limpiar títulos
   - asignar tags
3. Agregar soporte para `expense`.
4. Crear `Orchestrator.processInput(text)`.
5. Hacer que `UniversalInput` llame al orchestrator, no directamente al parser.
6. Crear queries reutilizables para filtros por tipo.
7. Mantener `entries` como fuente única de verdad.
8. Ejecutar:
   - npm run typecheck
   - npm run build

## Frases de prueba
- super 35k
- feria 18 lucas verduras
- pagar internet viernes 21990
- comida Thor mañana 25k
- remedio mamá 9am
- cita médica lunes
- llamar a mamá mañana
- revisar aceite auto