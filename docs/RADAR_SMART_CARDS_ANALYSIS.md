# LIEV — RADAR + SMART CARDS: ANÁLISIS TÉCNICO/UX

## Diagnóstico actual

### Radar (src/core/cognitive/normalize-radar-result.ts)

**Arquitectura actual:**
- Dual-layer: `buildHeuristicRadarResult()` (local-first) + `normalizeRadarResult()` (normalizador defensivo)
- El heurístico usa `inferType()` que cascada-pregunta por intención: shopping → payment → pet → health → calendar → task → note
- El `normalizeRadarResult` recibe un candidato raw (podría venir de IA) y lo sanitiza con Zod (`RadarCardSchema`)
- `computeHeuristicConfidence()` asigna confidence por tipo basado en reglas duras: items count, store presence, time/date presence, verb signals
- `shouldUseAI()` decide si el heurístico es suficiente o si necesita refuerzo IA: 7 triggers claros (long-form, año sin contexto financiero, confidence < 0.82, payment sin monto, note con señales mixtas, múltiples intenciones, checklist vacío con contexto de compra)

**Fortalezas del radar actual:**
1. `shouldUseAI` es conservador: NO llama IA para casos claros (shopping con 3 items + store, payment con monto + verb, appointment con date+time, pet con nombre)
2. Sanitizador defensivo: `stripTotal`, `looksLikeYearInDateContext`, `parseMoneyCandidate`, `sanitizeChecklistItems` — 4 líneas de defensa contra datos sucios
3. `confidence` es computado por heurística, no por un modelo opaco. El usuario puede entender por qué algo se clasificó así
4. `fallbackUsed` flag: cuando `Object.keys(candidate).length === 0`, usa heurístico puro
5. `normalizeRadarResult` siempre retorna un contrato Zod válido o null — no hay estados corruptos

**Debilidades del radar:**
1. **Duplicación de reglas con parser-rules.ts y surface-resolver.ts**: `hasShoppingIntent`, `hasPaymentIntent`, `hasHealthIntent`, `hasPetAction` están definidos en `parser-rules.ts` y replicados/mirreados en `normalize-radar-result.ts` (ej: `hasFinancialContext` es una versión más amplia que `hasPaymentIntent` pero con overlap del 70%)
2. **Duplicación de `STORE_PATTERNS`**: `inferStoreType` usa regex inline en `normalize-radar-result.ts` que son casi idénticas a `STORE_PATTERNS_TEST` en el test file y a lógica que probablemente existe en `radarToEntry`
3. **Duplicación de `FORBIDDEN_ITEM_WORDS`**: idéntico set en `normalize-radar-result.ts` y `tests/radar-intake.test.mjs` — cualquier cambio requiere 2 archivos
4. **`inferType` es cascada sin pesos**: `hasShoppingIntent` gana siempre. Si escribo "pagar compras supermercado" → se clasifica como `shopping_list`, no `payment`. No hay scoring ponderado.
5. **`isLongFormNote` existe en 3 lugares**: `parser-rules.ts`, `normalize-radar-result.ts` (no importado directamente, pero el test lo mira), `surface-resolver.ts` (función idéntica con más casos). Si cambia uno, los otros quedan desactualizados
6. **`appointment` vs `calendar` vs `health`**: `inferType` retorna `appointment` cuando detecta `hora|cita|consulta|medico|doctor|dentista|kine`, pero el `EntryTypeSchema` tiene `appointment`, `health`, `calendar`. Luego `TYPE_TO_SURFACE` mapea `appointment → appointments` y `calendar → appointments`. Esto es confuso: el usuario ve "appointment" en el tipo pero no hay un agente de calendar (el `HEALTH_AGENT` cubre `health` y `appointment`). El `calendar` type existe pero su agente no.
7. **`normalizeMoney` tiene edge cases**: `new RegExp("\\b" + amount + "\\b\\s*:\\s*\\d{2}\\b").test(rawText)` intenta evitar "2026: 15" como monto, pero la regex es frágil y no escala
8. **`sanitizeChecklistItems` hace doble trabajo**: si no hay items del candidato, intenta split del texto crudo por palabras comunes. Esto es "magic fallback" que a veces funciona y a veces genera items como "para" si el set no está perfectamente sincronizado

### Surface Resolver (src/core/display/surface-resolver.ts)

**Fortalezas:**
- `isLongFormNote` es el guardián más fuerte: research/docs nunca contaminan surfaces
- `shouldShowOnSurface` es la API pública para category pages, nunca usa `entry.type` directo
- `getPrimarySurface` tiene orden de prioridad claro: long-form > payment > shopping > pet > health > task > calendar

**Debilidades:**
- `isLongFormNote` está duplicada (mirrors comment line 72-80 en `display-rules.ts` dice "sin importar para evitar problemas con Node experimental strip types")
- `hasActionablePurchaseIntent` usa regex inline que duplica `hasShoppingIntent` del parser
- `hasFinanceIntent` requiere `entry.type === 'payment' AND typeof entry.amount === 'number'`. Si un pago pierde su amount (bug de sync), desaparece de `/payments` incluso si tiene texto "pagar factura"
- `hasCalendarMetadata` revisa `metadata.calendar.events` array, pero no valida que sea un array de eventos bien formados

### Display Rules (src/core/display/display-rules.ts)

**Fortalezas:**
- `shouldShowCalmExplanation` es condicional: solo muestra si hay low confidence, autoCorrected, o outsidePrimarySurface
- `isGenericExplanation` filtra las 5 frases genéricas para no mostrarlas sin razón
- `shouldShowCorrectionHint` es más permisivo: muestra hint para reclassification

**Debilidades:**
- `isGenericExplanation` usa hardcoded array de strings exactos. Si cambia un calmExplanation en un agente, hay que actualizar este array también
- `shouldShowOriginalText` compara `original.toLowerCase() === displayTitle.toLowerCase()` — esto es correcto pero no maneja el caso donde el original tiene "comprar" al inicio y el título lo strippeó
- `getCalendarDisplayCopy` retorna `headline: ''` para calendario sin metadata — podría retornar null

### Card Agents (src/core/card-agents/)

**Fortalezas:**
- Arquitectura limpia: cada agente es config-only, no ejecuta código
- `correction.allowedTargetTypes` define qué tipos puede recibir un reclassification manual
- `README.md` documenta qué está wireado y qué no
- `resolveCardAgent` es read-only, no muta

**Debilidades:**
- `surfaces.primary` y `surfaces.secondary` están definidos pero no consumidos por el UI (según README: "Computed correctly, no downstream consumer yet")
- `classification.signals` y `priority.*` son documentation-only — no tienen runtime effect. El parser real no los usa
- `calmExplanation` y `correctionHint` son strings estáticos. No adaptan al contexto (ej: "Pago pendiente" siempre, aunque el pago esté vencido)
- No hay agente para `calendar` type (solo `health` cubre `appointment`)
- `TASK_AGENT` cubre `task` y `reminder`, pero `reminder` no está en `EntryTypeSchema` — solo `task` y `reminder` son tipos separados en el schema? No, `EntryTypeSchema` tiene `reminder`? Sí, line 12: `calendar` está, pero `reminder` no está en el schema. Espera, el schema dice: `'note', 'task', 'payment', 'appointment', 'shopping_list', 'health', 'pet', 'calendar'`. No hay `reminder`. Pero `TASK_AGENT` type es `[task, reminder]`. `reminder` no es un tipo válido según el schema. Esto es un bug o un tipo legacy.

### TimelineView (src/components/TimelineView.tsx)

**Fortalezas:**
- `TimelineItem` usa `grid-template-rows` para animación de expand/collapse
- Checklist interactivo funciona (both Dexie checklist y metadata shopping)
- `ProgressLabel` muestra estado de compra con progreso
- `NoteReader` ya está integrado para `entry.type === 'note'` (line 779: `entry.type === 'note' ? () => onReadNote?.(entry) : () => setExpanded((p) => !p)`)

**Debilidades:**
- Lógica condicional masiva: `isShoppingList`, `isPayment`, `isPetOrHealth`, `isCalendar` — con ramas de renderizado separadas para cada tipo
- Collapsed checklist preview: solo muestra 1 item (`slice(0, 1)`) para metaShopping, pero 1 para checklistItems también — y luego "+N más". Esto es inconsistente con lo que dice UX_AUDIT que son 3 items
- `displayType` tiene 10 líneas de ternarios anidados — es difícil de mantener
- `TimelineItem` renderiza `expanded` inline — una lista de 15 items de compra crece la card a 500px+
- `getPrimarySurface` se importa de `surface-resolver.ts` y se usa para `displayType`, pero el `currentSurface` prop ya viene de la página. Hay overlap de responsabilidad
- `DetailLine` y `CalendarDetail` son sub-componentes inline, no reutilizables
- `editing` state es inline: un `input` aparece inline en la card, no en un editor dedicado
- No hay `onReadNote` para tipos no-note: `entry.type === 'note' ? onReadNote : setExpanded`. Las notas abren Reader, todo lo demás expande inline. Esto es inconsistente.

### UniversalInput (src/components/UniversalInput.tsx)

**Fortalezas:**
- Tokenización en tiempo real: amount, date, time se resaltan con colores
- Chips de preview: tipo, monto, fecha, hora
- `radarIntake` es opcional y behind flag (`RADAR_ENABLED`)
- Fallback a `processInput` si radar falla
- `submittingRef` previene double-submit
- Guarda el texto si hay error (`setError` + retry timeout)

**Debilidades:**
- Preview solo muestra tipo, amount, date, time. No muestra storeType, checklist preview, ni confidence
- No hay feedback de clasificación: el usuario escribe "ir al super" y no sabe si se clasificará como task o shopping_list
- `previewInput` (del orchestrator) y `radarIntake` pueden dar resultados diferentes — el preview usa heurístico local, el submit usa radar
- No hay modo de corregir antes de guardar: si el preview dice "tarea" pero el usuario quería "lista", no puede cambiar

### Tests (tests/radar-intake.test.mjs)

**Fortalezas:**
- 35+ tests cubriendo sanitización, validación, edge cases, y shouldUseAI
- Tests inline de `normalizeRadarCandidate` (mirror del route handler)
- Tests de `shouldUseAI` confirman que los casos claros NO llaman IA

**Debilidades:**
- `tests/radar-intake.test.mjs` tiene copias inline de `FORBIDDEN_ITEM_WORDS`, `STORE_PATTERNS_TEST`, `TYPE_TO_SURFACE_TEST`, `CHECKLIST_DATE_STORE_WORDS_TEST`, `FINANCIAL_KEYWORDS_TEST` — todo duplicado del código fuente
- Los tests de `validateRadarResult` no usan el schema Zod real — usan una implementación inline que puede divergir
- No hay tests de `surface-resolver.ts` ni `display-rules.ts`
- No hay tests de integración: `radarToEntry` → `addEntry` → `resolveSurfaceForEntry` → `TimelineView` render

---

## Problemas prioritarios

### P1 — DUPLICACIÓN DE REGLAS (CRÍTICO)
**Impacto:** Alto. **Esfuerzo:** Medio.

Las reglas de intención están en 4 lugares: `parser-rules.ts`, `normalize-radar-result.ts`, `surface-resolver.ts`, `tests/radar-intake.test.mjs`. Un cambio en "¿qué cuenta como lista de compras?" requiere editar 4 archivos. Esto garantiza inconsistencias.

**Ejemplo concreto:** `hasShoppingIntent` en `parser-rules.ts` bloquea `modulo|flujo|categoria|investigacion`. `normalize-radar-result.ts` no usa `hasShoppingIntent` directamente — usa `hasShoppingIntent` importado del parser. Pero `surface-resolver.ts` tiene `hasActionablePurchaseIntent` con regex inline que no bloquea esos términos. Si escribo "modulo compras feria", el parser dice "no es shopping", pero el surface resolver dice "sí es purchases".

### P2 — INCONSISTENCIA NOTE vs READER vs EXPANDED (CRÍTICO)
**Impacto:** Alto. **Esfuerzo:** Medio.

Notas abren `NoteReader` (overlay). Todo lo demás expande inline (`setExpanded`). El usuario no tiene un modelo mental consistente: a veces tap = leer, a veces tap = expandir card gigante.

**Evidencia:** `TimelineView.tsx` línea 779: `entry.type === 'note' ? () => onReadNote?.(entry) : () => setExpanded((p) => !p)`.

### P3 — CALENDAR/HEALTH/APPOINTMENT TIPO CONFLICTIVO (ALTO)
**Impacto:** Alto. **Esfuerzo:** Bajo.

`EntryTypeSchema` tiene `appointment`, `health`, `calendar`. `TYPE_TO_SURFACE` mapea `appointment → appointments` y `calendar → appointments`. `HEALTH_AGENT` cubre `health` y `appointment`. No hay agente para `calendar`. `inferType` retorna `appointment` cuando detecta médico, `calendar` cuando detecta `reunion|cumpleanos|cita|hora|agenda|agendar`. Pero `calendar` no tiene agente ni surface propio.

**Riesgo:** Una "reunión de trabajo" se clasifica como `calendar` pero no hay agente. `getAgentForType('calendar')` retorna undefined. El UI usa `NOTE_AGENT` fallback. Pero `surface-resolver.ts` `getPrimarySurface` maneja `hasCalendarMetadata` → `calendar`, pero no `entry.type === 'calendar'`. Entonces una entry `type: 'calendar'` sin metadata calendar va a `notes` en lugar de `calendar`.

### P4 — CARD AGENTS SON SOLO DOCUMENTACIÓN (ALTO)
**Impacto:** Medio. **Esfuerzo:** Medio.

`classification.signals`, `priority.boostConditions`, `surfaces.secondary` — todo es documentation-only. El parser real no los usa. El resolver de surfaces no los usa. Esto significa que el card agent system es un sistema de config paralelo que no tiene runtime effect.

**Consecuencia:** Si quiero que el radar use los `signals` definidos en el agente para mejorar clasificación, no puedo — tendría que duplicar las reglas en `parser-rules.ts`.

### P5 — CONFIDENCE NO ES ADAPTATIVO (MEDIO)
**Impacto:** Medio. **Esfuerzo:** Bajo.

`computeHeuristicConfidence` usa reglas fijas. Si el usuario corrige manualmente una clasificación 3 veces, el sistema no aprende. La confianza del heurístico no se ajusta por feedback.

### P6 — NO HAY RECLASIFICACIÓN MANUAL (ALTO)
**Impacto:** Alto. **Esfuerzo:** Medio.

`correction.allowedTargetTypes` está definido en cada agente, pero no hay UI de reclassification. El usuario no puede decir "esto no es una tarea, es un pago". La única forma de corregir es editar el texto y reparsear (`reparseAndUpdateEntry`), lo cual es destructivo.

### P7 — OPENROUTER NO ESTÁ INTEGRADO (NO ES PROBLEMA AÚN)
**Impacto:** Medio. **Esfuerzo:** Alto.

`shouldUseAI` está listo pero no hay implementación de OpenRouter. Esto es correcto — no es un bug, es una feature pendiente. El riesgo es que cuando se integre, no hay rate limiting, cost control, ni response Zod schema definido.

---

## 1. Estado actual del Radar

### ¿Cómo clasifica hoy?

1. **Pre-parser**: `UniversalInput` tokeniza y preview con `previewInput` (heurístico local del orchestrator)
2. **Submit**: `radarIntake(trimmed)` → si `RADAR_ENABLED` es true. Si no, `processInput`
3. **Radar pipeline** (desconocido, no está en los archivos leídos, pero probablemente):
   - Si hay candidato de IA (OpenRouter): `normalizeRadarResult(rawAI, rawText)` → valida Zod → retorna
   - Si no hay IA o IA falla: `buildHeuristicRadarResult(rawText)` → heurístico puro → retorna
4. **Normalizador**: `normalizeRadarResult` sanitiza el candidato (sea de IA o heurístico) y lo valida con Zod
5. **Conversión**: `radarToEntry(radar, rawText)` → convierte a `ParsedEntry` para `addEntry`
6. **Surface resolver**: `resolveSurfaceForEntry(entry)` → determina qué surfaces mostrar la entry
7. **Display**: `TimelineView` renderiza según `entry.type`

### ¿Dónde falla?

**Fallos conocidos por los tests:**
- `buscar vuelos diciembre 2026` → a veces `task`, a veces `note` — la heurística no distingue bien "buscar" como research vs task
- `pagar la cuenta del agua` (sin monto) → se clasifica como `note` o `task` con señal de pago, no `payment` — `shouldUseAI` detecta esto y pediría IA
- `ir al super` → sin items, no se clasifica como `shopping_list` — `shouldUseAI` lo detecta
- Textos con año y contexto no financiero → `shouldUseAI` retorna true (bueno)
- `payment` con `amount` pero sin palabra clave financiera → `inferType` requiere `hasPaymentIntent(text) || /\bpago\b/.test` y `normalizeMoney !== null`. Si escribo "deuda 50000" → `hasPaymentIntent` detecta "deuda", `normalizeMoney` detecta 50000 → payment. Pero si escribo "50000" solo → note con amount=50000 (porque `hasPaymentIntent` es false)

**Fallos de arquitectura:**
- `appointment` vs `health` vs `calendar`: una "cita médica" puede ser `appointment` o `health` dependiendo de si detecta `médico` o `hora`. El usuario no entiende la diferencia. El UI las trata diferente (health tiene `isPetOrHealth` branch, appointment no)
- `reminder` type: existe en `TASK_AGENT` pero no en `EntryTypeSchema`. Esto es un bug.
- `shopping_list` con un solo item: `shouldBuildShoppingList` requiere `itemCount >= 1` + `hasStoreKeyword || hasKnownCategory`. Si escribo "comprar pan" → 1 item, no store keyword, no known category → NO es shopping_list. Es `task`. El usuario esperaría "lista de compras".

### ¿Qué reglas están duplicadas?

| Regla | Ubicación 1 | Ubicación 2 | Ubicación 3 | Ubicación 4 |
|-------|-------------|-------------|-------------|-------------|
| `hasShoppingIntent` | `parser-rules.ts` | `surface-resolver.ts` (inline) | `normalize-radar-result.ts` (import) | `tests/radar-intake.test.mjs` (inline FINANCIAL_KEYWORDS) |
| `hasPaymentIntent` | `parser-rules.ts` | `surface-resolver.ts` (hasFinanceIntent) | `normalize-radar-result.ts` (hasFinancialContext) | `tests/radar-intake.test.mjs` |
| `hasHealthIntent` | `parser-rules.ts` | `surface-resolver.ts` (import) | `normalize-radar-result.ts` (import) | — |
| `hasPetAction` | `parser-rules.ts` | `surface-resolver.ts` (import) | `normalize-radar-result.ts` (import) | — |
| `isLongFormNote` | `parser-rules.ts` | `surface-resolver.ts` | `display-rules.ts` (isResearchOrLongDoc) | — |
| Store patterns | `normalize-radar-result.ts` | `tests/radar-intake.test.mjs` | — | — |
| Forbidden words | `normalize-radar-result.ts` | `tests/radar-intake.test.mjs` | — | — |
| Date words | `normalize-radar-result.ts` | `UniversalInput.tsx` | `tests/radar-intake.test.mjs` | — |
| TYPE_TO_SURFACE | `normalize-radar-result.ts` | `surface-resolver.ts` (inline) | `tests/radar-intake.test.mjs` | — |

### ¿Qué parte es heurística?

**100% heurística hoy:**
- `buildHeuristicRadarResult` — reglas duras, regex, conteo de items
- `computeHeuristicConfidence` — scoring basado en reglas manuales
- `shouldUseAI` — decisión de si llamar IA basada en heurística
- `surface-resolver.ts` — todo es regex y type-checking
- `display-rules.ts` — todo es metadata checking y regex
- `UniversalInput.tsx` preview — heurístico local

### ¿Qué parte puede conectarse a OpenRouter?

**Ready para OpenRouter:**
- `shouldUseAI` ya define CUÁNDO llamar IA (7 triggers)
- `normalizeRadarResult` ya acepta un candidato raw — puede ser respuesta de IA
- `RadarCardSchema` es Zod — puede validar respuesta de IA
- `fallbackUsed` flag — si IA falla, se usa heurístico

**Qué faltaría para OpenRouter:**
- Prompt template con few-shot examples en español
- `zod-to-json-schema` para forzar respuesta estructurada (OpenRouter soporta JSON mode)
- Rate limiter: max X calls/minute, max Y tokens/request
- Costo: tracking de tokens usados, alerta si supera $Z/mes
- Timeout: 3-5 segundos máximo, fallback a heurístico si timeout
- No blocking: la llamada debe ser async, no bloquear el submit del usuario

### ¿Qué riesgos hay si metemos IA ahora?

1. **Latencia**: OpenRouter añade 1-3 segundos. El usuario escribe "comprar pan" y espera 3 segundos para guardar? No — la llamada debe ser background, no blocking. Pero si el heurístico dice "no sé" (shouldUseAI=true) y la IA tarda 3 segundos, el usuario ve "guardando..." por 3 segundos.
2. **Costo**: Con 100 usuarios, 10 entradas/día cada uno, y 50% de las entradas requiere IA (shouldUseAI=true) = 500 llamadas/día. GPT-4o mini cuesta ~$0.15/1M tokens. 500 prompts de ~200 tokens = 100K tokens/día = $0.015/día = $0.45/mes. Manejable.
3. **Sobreclasificación**: IA puede clasificar todo como `note` si no está bien prompteado. O puede "alucinar" montos que no existen. El `normalizeRadarResult` sanitiza, pero la IA puede retornar `amount: 999999` para "pagar mucho dinero".
4. **Inconsistencia**: IA y heurístico pueden dar resultados diferentes para el mismo texto. El usuario escribe "comprar pan" un día y el heurístico dice `shopping_list`. Otro día, si la IA lo procesa, puede decir `task`. Modelo inconsistente = confianza rota.
5. **Dependencia de red**: Si no hay internet, `shouldUseAI` retorna true pero no hay IA. Fallback a heurístico funciona, pero el usuario nunca sabe si usó IA o no.

---

## 2. Card Intelligence

### Regla general: "Collapsed = decisión, Reader = contexto, Edit = corrección"

| Tipo | Collapsed (qué decisión) | Reader (qué contexto) | Edit (qué corregir) | Metadata esencial | Metadata oculta |
|------|--------------------------|----------------------|--------------------|-------------------|----------------|
| **note** | ¿Leer o no? | Texto completo, fecha, tags | Título, cuerpo, tags | Título, fecha | — |
| **task** | ¿Hecha o no? | Título, fecha, detalle original | Texto, fecha, tipo | Título, fecha | Próximo paso (auto-generated) |
| **payment** | ¿Pagada o no? | Título, monto, fecha, status, tipo (ingreso/egreso) | Texto, monto, fecha, tipo | Título, monto, fecha | Categoría financiera, dirección (income/expense) |
| **shopping_list** | ¿Comprar hoy? | Items completos, total estimado, store | Items, store, total | Store, checked/total | Items individuales en collapsed |
| **health** | ¿Ir o no? | Título, fecha, hora, detalle | Texto, fecha, tipo (health/appointment) | Título, fecha, hora | — |
| **pet** | ¿Hacer o no? | Título, fecha, hora, detalle | Texto, fecha | Título, fecha, hora | — |
| **calendar** | ¿Asistir? | Eventos agendados, horarios | Texto, fecha, eventos | Fecha, eventos | Count de eventos |

### Decisiones para cada tipo

**note:**
- Collapsed: Título (1 línea), preview del cuerpo (2 líneas, clamp), fade-bottom. No mostrar type pill (es note, default). No mostrar fecha a menos que sea relevante.
- Reader: Título + cuerpo completo + fecha + tags. Opción "Editar".
- Edit: Título editable, cuerpo editable (textarea grande), tags.
- Metadata esencial: createdAt, updatedAt.
- Metadata oculta: parserConfidence, autoCorrected, reason.

**task:**
- Collapsed: Checkbox, título (1 línea), fecha si existe, prioridad dot (solo si urgente). NO microcopy. NO type pill.
- Reader: Título, fecha, detalle original, checkbox de done. Botón "Convertir a pago/nota".
- Edit: Texto, fecha, tipo.
- Metadata esencial: done, date, priority.
- Metadata oculta: nextStep (auto-generated), calmExplanation.

**payment:**
- Collapsed: Título (sin "pagar" prefix), monto, fecha, status badge (solo si vencido o pagado). NO type pill (el monto ya lo identifica). NO checkbox de done (el done es conceptual, no visual).
- Reader: Título, monto, fecha, status, tipo (ingreso/egreso), categoría financiera, detalle original. Botón "Marcar como pagado".
- Edit: Texto, monto, fecha, tipo (income/expense), categoría.
- Metadata esencial: amount, currency, status, date.
- Metadata oculta: financialDirection, financialCategory, parserConfidence.

**shopping_list:**
- Collapsed: Checkbox (todos/nada conceptual), título ("Lista de compras" o generado), store badge (solo si no es "otro"), checked/total count, total estimado. NO preview de items individuales.
- Reader: Título, items interactivos (con checkboxes), total, store. Botón "Añadir item".
- Edit: Items (lista editable), store, total.
- Metadata esencial: storeType, checklist items, totalEstimated.
- Metadata oculta: possibleTotal, shoppingCompletion.

**health:**
- Collapsed: Título, fecha, hora. NO checkbox de done (health no es "done").
- Reader: Título, fecha, hora, detalle, tipo (cita vs recordatorio). Botón "Reprogramar".
- Edit: Texto, fecha, hora, tipo (health/appointment).
- Metadata esencial: date, time, type.
- Metadata oculta: priority, calmExplanation.

**pet:**
- Collapsed: Título, fecha, hora. Ícono de mascota sutil.
- Reader: Título, fecha, hora, detalle. Botón "Hecho".
- Edit: Texto, fecha, hora.
- Metadata esencial: date, time.
- Metadata oculta: checklist items (si aplica), priority.

**calendar:**
- Collapsed: Fecha, count de eventos ("3 eventos"). NO título (no hay título en calendar metadata).
- Reader: Fecha, lista de eventos con horarios, prompt para agregar horarios si faltan.
- Edit: Fecha, eventos (lista editable).
- Metadata esencial: date, calendar.events.
- Metadata oculta: expectedCount, kind.

---

## 3. Reclasificación manual

### Flujo propuesto

```
1. Usuario tap en card → Reader Mode
2. En Reader Mode: toolbar con opción "Corregir"
3. Tap "Corregir" → menú de acciones:
   a. "Cambiar tipo" → lista de tipos permitidos (leído de `correction.allowedTargetTypes`)
   b. "Corregir fecha" → date picker
   c. "Corregir monto" → input numérico
   d. "Esto no es lo que parece" → envía feedback anónimo
4. Selección → actualización optimista en UI → guardar en Dexie
5. Si cambia tipo: `reparseAndUpdateEntry` con type override, o `updateEntry` con `type: newType` y `metadata.reclassifiedFrom: oldType`
6. Feedback guardado en `metadata.userFeedback` array:
   ```json
   {
     "userFeedback": [
       { "action": "reclassify", "from": "task", "to": "payment", "timestamp": "...", "text": "..." },
       { "action": "correctDate", "from": "2026-06-10", "to": "2026-06-12", "timestamp": "..." }
     ]
   }
   ```
```

### Reglas de `allowedTargetTypes`

| De tipo | Puede cambiar a |
|---------|----------------|
| note | task, reminder |
| task | note, payment, health |
| payment | task, note |
| shopping_list | task, note |
| health | task, note |
| pet | task, note |
| calendar | task, note |

**Nota:** `calendar` no tiene agente pero el usuario puede querer convertirlo a `task` si no es un evento.

### Guardar feedback para mejorar Radar

- No reentrenar localmente (no hay modelo local). Pero sí:
  1. Guardar feedback en `metadata.userFeedback`
  2. Si el usuario corrige el mismo tipo de error 3 veces (ej: "comprar" siempre lo reclasifica de `task` a `shopping_list`), ajustar peso del heurístico localmente: bajar el threshold de `shouldBuildShoppingList` para ese usuario
  3. En un futuro (Fase 3), exportar feedback a un dataset para fine-tuning de un modelo ligero

---

## 4. OpenRouter

### ¿Cuándo llamar IA?

**Triggers definidos en `shouldUseAI` (ya listos, funcionan):**
1. Long-form note (>500 chars, markdown, numbered sections)
2. Año en contexto no financiero (riesgo de amount/año)
3. Confidence < 0.82
4. Shopping list sin items suficientes (< 2 items)
5. Shopping list sin store y sin contexto claro
6. Payment sin monto
7. Note con señales mixtas de otras categorías
8. Múltiples intenciones detectadas (> 1)
9. Texto largo con note pero con posible intención oculta (> 80 chars + "para|necesito|tengo que|debo|hay que")
10. Checklist vacío cuando parece lista (contexto de compra pero sin items)

**NUEVO trigger propuesto (post-análisis):**
11. Reclasificación manual: si el usuario corrige un tipo, el próximo texto similar debe usar IA para confirmar

### ¿Cuándo NO llamar IA?

- Casos claros: shopping list con 3+ items y store, payment con monto + verb, appointment con date+time, pet con nombre + acción, note simple sin señales mixtas
- Texto corto (< 30 chars) con una sola intención clara
- Entrada repetida: si el usuario ya escribió "comprar pan leche" antes y se clasificó bien, usar cache local
- Offline: `navigator.onLine === false` → siempre heurístico

### Fallback local

- Si OpenRouter falla (timeout, error, rate limit): `buildHeuristicRadarResult(rawText)` inmediato
- Si OpenRouter retorna schema inválido: `normalizeRadarResult` detecta `!result.success` y usa fallback
- Si OpenRouter retorna confidence < 0.75: el caller puede decidir usar heurístico en su lugar

### Rate limit

- **Por usuario**: Max 10 llamadas/minuto, max 50 llamadas/hora
- **Por app**: Max 1000 llamadas/día (protección contra bot/spam)
- **Por request**: Timeout 5 segundos
- **Backoff**: Si falla, no reintentar durante 30 segundos

### Costo controlado

- **Modelo**: GPT-4o mini (suficiente para clasificación, muy barato)
- **Prompt**: ~200 tokens input, ~100 tokens output
- **Costo**: ~$0.000075 por request
- **Presupuesto**: $5/mes hard cap (si se supera, desactivar IA automáticamente)
- **Tracking**: Guardar `metadata.aiCost` en cada entry con IA (tokens in/out, model, timestamp)
- **Alerta**: Si 80% del presupuesto mensual se consume, mostrar warning en dev console (no al usuario)

### Respuesta Zod estricta

```typescript
// El prompt debe forzar JSON con esta estructura exacta:
const RadarResponseSchema = z.object({
  type: EntryTypeSchema,
  title: z.string().min(1).max(100),
  summary: z.string().max(200).nullable(),
  date_text: z.string().max(50).nullable(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  amount: z.number().positive().max(100_000_000).nullable(),
  currency: z.literal('CLP').nullable(),
  store_context: z.string().max(50).nullable(),
  checklist_items: z.array(z.string().max(50)).max(30),
  tags: z.array(z.string()).max(10),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
});

// OpenRouter debe usar response_format: { type: "json_object" }
// y el system prompt debe incluir el schema como JSON Schema.
```

### No bloquear UX si falla IA

```typescript
// En radarIntake:
async function radarIntake(text: string): Promise<RadarCardContract | null> {
  const heuristic = buildHeuristicRadarResult(text);
  
  if (!shouldUseAI(text, heuristic)) {
    return heuristic; // 80% de casos
  }
  
  // 20% de casos: llama IA en background
  const aiPromise = callOpenRouter(text, { timeout: 5000 });
  
  // Race: si IA tarda más de 5s, usa heurístico
  const aiResult = await Promise.race([
    aiPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);
  
  if (aiResult) {
    const normalized = normalizeRadarResult(aiResult, text);
    if (normalized.ok && normalized.data) {
      return normalized.data;
    }
  }
  
  // Fallback: heurístico
  return heuristic;
}
```

---

## 5. Roadmap por fases

### Fase 2A: Limpiar reglas actuales (Semana 1)

**Objetivo:** Eliminar duplicación y consolidar fuentes de verdad.

**Tareas:**
1. **Unificar `isLongFormNote`**: Crear `src/core/agents/intent-guards.ts` que exporte `isLongFormNote`, `hasShoppingIntent`, `hasPaymentIntent`, `hasHealthIntent`, `hasPetAction`, `hasProjectIntent`. Eliminar las definiciones inline en `surface-resolver.ts` y `display-rules.ts`.
2. **Unificar `STORE_PATTERNS`**: Mover `STORE_PATTERNS` a `src/core/agents/store-patterns.ts` y consumirlo desde `normalize-radar-result.ts` y tests.
3. **Unificar `FORBIDDEN_ITEM_WORDS`**: Mover a `src/core/agents/shopping-sanitizer.ts` junto con `sanitizeChecklistItems`. Consumir desde `normalize-radar-result.ts` y tests.
4. **Unificar `TYPE_TO_SURFACE`**: Crear `src/core/agents/type-surface-map.ts` y consumir desde `normalize-radar-result.ts` y `surface-resolver.ts`.
5. **Eliminar `reminder` type**: `TASK_AGENT` type debe ser `['task']` o añadir `reminder` a `EntryTypeSchema`. Recomendación: eliminar `reminder` del agente y usar `task` para todo.
6. **Crear `calendar` agent**: Si `calendar` type existe en schema, necesita un agente. O eliminar `calendar` del schema y usar `appointment` para todo calendario.
7. **Tests**: Refactorizar `tests/radar-intake.test.mjs` para importar las funciones reales en lugar de inline mirrors. Esto requiere que las funciones no usen `@/` aliases (o compilar tests con tsx/ts-node).

**No tocar:**
- `UniversalInput.tsx` (excepto imports si cambian paths)
- `db/entries.ts` (no tocar sync logic)
- `TimelineView.tsx` (no tocar render aún)

**Riesgo:** Bajo. Solo movimiento de código. Todos los tests deben seguir pasando.

### Fase 2B: Reclasificación manual (Semana 2)

**Objetivo:** Permitir al usuario corregir clasificación sin editar texto.

**Tareas:**
1. **Añadir `reclassifyEntry` en `db/entries.ts`**:
   ```typescript
   export async function reclassifyEntry(id: number, newType: EntryType): Promise<void> {
     await db.entries.update(id, {
       type: newType,
       updatedAt: new Date(),
       'metadata.reclassifiedFrom': entry.type, // Dexie dot notation?
     });
   }
   ```
   Nota: Dexie no soporta dot notation en `update`. Se necesita `entry.metadata = { ...entry.metadata, reclassifiedFrom: oldType }`.

2. **Añadir `updateEntryMetadata` en `db/entries.ts`**:
   ```typescript
   export async function updateEntryMetadata(id: number, patch: Partial<Record<string, unknown>>): Promise<void> {
     const entry = await db.entries.get(id);
     if (!entry) return;
     await db.entries.update(id, {
       metadata: { ...entry.metadata, ...patch },
       updatedAt: new Date(),
     });
   }
   ```

3. **Crear `ReaderDrawer` component** (o extender `NoteReader`):
   - Usar `NoteReader` como base para todos los tipos (no solo notes)
   - Añadir toolbar inferior con: "Editar", "Corregir tipo", "Eliminar", "Pin"
   - "Corregir tipo" → bottom sheet con lista de `allowedTargetTypes`

4. **Wirear `NoteReader` para todos los tipos**:
   - En `TimelineView.tsx`, cambiar: `onClick={() => onReadNote?.(entry)}` para TODOS los tipos, no solo `note`
   - Eliminar `setExpanded` logic para non-note types (o dejarlo como fallback)

5. **Añadir `userFeedback` a metadata**:
   - Estructura: `{ action: 'reclassify' | 'correctDate' | 'correctAmount', from: ..., to: ..., timestamp: string }`
   - Guardar en `metadata.userFeedback` array

**No tocar:**
- `normalize-radar-result.ts` (excepto imports)
- `surface-resolver.ts` (no cambiar lógica, solo imports)
- `UniversalInput.tsx` preview

**Riesgo:** Medio. Cambia UX de interacción principal. Si `NoteReader` no está listo para non-notes, puede romper visualmente.

### Fase 2C: IA opcional con OpenRouter (Semana 3-4)

**Objetivo:** Integrar OpenRouter como refuerzo opcional, no requisito.

**Tareas:**
1. **Crear `src/core/cognitive/openrouter-client.ts`**:
   - `callOpenRouter(text, options)` → retorna raw JSON
   - Rate limiter: token bucket o simple counter
   - Timeout: 5s
   - Fallback: null on error
   - Cost tracking: `metadata.aiCost` en respuesta

2. **Crear prompt template**:
   ```
   System: Eres un clasificador de entradas para una libreta personal. Clifica el texto del usuario en una de estas categorías: note, task, payment, shopping_list, health, pet, calendar. Extrae: título, fecha, hora, monto (solo si es pago), items (solo si es lista de compras), tipo de tienda. Responde SOLO en JSON válido con esta estructura: {...}
   
   User: {text}
   ```
   Incluir 5 few-shot examples en español chileno.

3. **Integrar en `radarIntake`**:
   - Usar `shouldUseAI` para decidir si llamar
   - Race condition: IA vs timeout
   - Si IA retorna schema inválido, fallback a heurístico
   - Si IA retorna confidence < 0.75, fallback a heurístico (o usar el más confiable)

4. **Feature flag**: `NEXT_PUBLIC_LIEV_OPENROUTER_ENABLED` (nuevo, separado de `RADAR_ENABLED`)

5. **Logging**: En dev, loggear comparación heurístico vs IA (para tunear `shouldUseAI`)

**No tocar:**
- `buildHeuristicRadarResult` (no cambiar)
- `shouldUseAI` (no cambiar triggers aún, solo añadir dev logging)
- `TimelineView.tsx` (no tocar UI)

**Riesgo:** Medio. Añade dependencia externa. Si el prompt no está bien, puede clasificar peor que el heurístico. Mitigación: `shouldUseAI` es conservador, solo llama IA cuando el heurístico ya está inseguro.

### Fase 2D: Cards inteligentes por tipo (Semana 4-5)

**Objetivo:** Implementar la tabla de Card Intelligence en el UI.

**Tareas:**
1. **Crear `EntryCard` unificado** (o refactorizar `TimelineItem`):
   - Variantes: `variant: 'compact' | 'reader'`
   - `compact`: usada en timeline. Altura controlada. Metadata mínima.
   - `reader`: usada en `NoteReader`. Muestra todo.
   - Render por tipo: `renderNote`, `renderTask`, `renderPayment`, etc.

2. **Implementar collapsed rules**:
   - note: título + 2 líneas preview, fade-bottom
   - task: checkbox + título + fecha (si existe)
   - payment: título + monto + fecha + status badge (solo si urgente)
   - shopping_list: título + store + checked/total + total estimado
   - health: título + fecha + hora
   - pet: título + fecha + hora
   - calendar: fecha + count de eventos

3. **Eliminar expansion inline**:
   - Todos los tipos abren `NoteReader` (o `ReaderDrawer`) al tap
   - Eliminar `setExpanded` state en `TimelineItem`
   - Eliminar `grid-template-rows` animation

4. **Eliminar ruido**:
   - Ocultar `calmExplanation` por defecto (mostrar solo en debug mode)
   - Ocultar `correctionHint` (mover a menú de acciones)
   - Ocultar `microcopy` en collapsed (mantener solo en reader si útil)
   - Eliminar `DetailLine label="Liev"` (mover a menú de acciones o debug)

5. **Metadata row unificada**:
   - Solo mostrar: fecha, monto, status badge (si urgente), progress count
   - No mostrar: type pill (usa border-left color), priority dot (solo urgente), microcopy

**No tocar:**
- `NoteEditor.tsx` (se toca en Fase 3)
- `db/entries.ts` sync logic
- `BottomNav`

**Riesgo:** Medio. Cambia drásticamente la interacción. Usuarios habituados a expandir inline pueden extrañar el drawer. Mitigación: transición suave con `framer-motion` o CSS transitions.

### Fase 3: Notas avanzadas + sketchnoting (Futuro)

**Objetivo:** Mejorar el espacio de notas para soportar contenido más rico.

**Tareas:**
1. **Rediseñar `NoteEditor`**: Fullscreen limpio, toolbar flotante, guardado auto, título inline
2. **Sketchnoting**: Soporte para dibujos/diagramas simples (canvas o SVG) adjuntos a notas
3. **Focus Mode**: Home sin chips, sin summary, solo input + timeline
4. **Daily digest**: `NextBestAction` como resumen matutino, no siempre visible

**No tocar ahora:**
- Todo lo de Fase 3 está en pausa hasta que Fase 2D esté estable.

---

## 6. Riesgos

### R1 — Romper sync
**Escenario:** Si cambiamos `entry.type` o `entry.metadata` structure, las entries viejas pueden no renderizar correctamente.
**Mitigación:**
- El `surface-resolver.ts` ya maneja legacy entries (comentado: "legacy entries may have wrong types from older parser versions")
- `display-rules.ts` usa `getMetadataRecord` que es defensivo
- Si cambiamos schema, usar `metadata.version` para migrar en lectura (no en DB)
- Nunca hacer migraciones masivas en Dexie sin user approval

### R2 — Romper parser actual
**Escenario:** Si refactorizamos `parser-rules.ts` y movemos funciones, `processInput` (del orchestrator) puede fallar.
**Mitigación:**
- `processInput` está en `src/core/agents/orchestrator.ts` (no leído). Necesitamos verificar que usa `parser-rules.ts`.
- Antes de mover funciones, leer `orchestrator.ts` y `processInput`.
- Mantener exports backward-compatible: si `hasShoppingIntent` se mueve, dejar un re-export en `parser-rules.ts`.

### R3 — Aumentar latencia
**Escenario:** OpenRouter añade 1-3s de latencia. Usuario escribe y espera.
**Mitigación:**
- `shouldUseAI` es conservador: solo ~20% de entradas necesitarán IA
- Race condition de 5s: si IA tarda, se usa heurístico inmediatamente
- Preview en `UniversalInput` es heurístico local (0ms)
- Submit puede ser async: el usuario ve "guardando..." pero puede seguir escribiendo (no es blocking si la UI lo maneja bien)

### R4 — Sobreclasificar
**Escenario:** IA clasifica todo como `payment` o `shopping_list` porque el prompt está mal.
**Mitigación:**
- `normalizeRadarResult` con Zod strict: si IA retorna type inválido, se usa fallback
- `shouldUseAI` no llama IA para casos claros: si escribo "comprar pan leche", el heurístico ya clasifica como `shopping_list` con confidence 0.92, IA no se llama
- Dev logging: comparar heurístico vs IA para detectar bias

### R5 — Perder calma visual
**Escenario:** Si añadimos más metadata, badges, chips, pills, la UI se vuelve dashboard.
**Mitigación:**
- Regla de oro: "¿Sin esto, el usuario puede decidir si actuar o no?"
- Collapsed solo muestra: título, 1-2 metadatos esenciales
- Todo lo demás va a Reader
- No añadir más elementos visuales a collapsed sin eliminar algo

### R6 — Meter IA donde no hace falta
**Escenario:** Llamar IA para "comprar pan leche" (0.92 confidence) es desperdicio.
**Mitigación:**
- `shouldUseAI` ya evita esto. El umbral de 0.82 es correcto.
- Si `buildHeuristicRadarResult` retorna confidence >= 0.82, no se llama IA
- Monitorear en dev: % de entradas que usan IA vs total. Si es > 30%, ajustar `shouldUseAI`.

---

## Quick wins

### QW1 — Eliminar `reminder` de `TASK_AGENT`
**Archivo:** `src/core/card-agents/task.agent.ts`
**Cambio:** `type: ['task']` en lugar de `['task', 'reminder']`
**Impacto:** Elimina un tipo fantasma que no existe en el schema. 1 línea.

### QW2 — Ocultar `calmExplanation` en collapsed
**Archivo:** `src/core/display/display-rules.ts`
**Cambio:** `shouldShowCalmExplanation` retorna `false` si `!context.expanded` (ya lo hace, pero asegurar que `expanded` nunca es true en collapsed)
**Impacto:** Menos ruido. 0 líneas si ya está bien, o 1 línea si hay un bug.

### QW3 — Limitar preview de checklist a 0 items
**Archivo:** `src/components/TimelineView.tsx`
**Cambio:** `collapsedItems` en shopping list: mostrar solo "+N items" en lugar de renderizar 1 item con checkbox
**Impacto:** Cards más compactas. 5 líneas.

### QW4 — Añadir `reclassifiedFrom` a `updateEntry`
**Archivo:** `src/db/entries.ts`
**Cambio:** Añadir `reclassifyEntry(id, newType)` que guarda `metadata.reclassifiedFrom`
**Impacto:** Habilita Fase 2B. ~15 líneas.

### QW5 — Unificar `isLongFormNote`
**Archivo:** Nuevo `src/core/agents/intent-guards.ts`, refactor `parser-rules.ts`, `surface-resolver.ts`, `display-rules.ts`
**Impacto:** Elimina duplicación. Previene bugs donde un documento es note en parser pero shopping en surface. ~30 líneas movidas.

### QW6 — Añadir `calendar` agent o eliminar `calendar` type
**Archivo:** `src/core/card-agents/calendar.agent.ts` o `src/core/contracts/card-contracts.ts`
**Impacto:** Elimina confusión de tipo sin agente. ~15 líneas.

### QW7 — Mostrar `displayType` como text-xs sin pill
**Archivo:** `src/components/TimelineView.tsx`
**Cambio:** En lugar de un pill con border y background, mostrar `displayType` como `text-xs uppercase` con color del type, sin border. Usar `border-left` sutil de 2px.
**Impacto:** Reduce ruido visual. ~10 líneas.

### QW8 — Eliminar `DetailLine label="Liev"`
**Archivo:** `src/components/TimelineView.tsx`
**Cambio:** Comentar o eliminar las líneas de `DetailLine label="Liev"` en expanded view de payment, pet, health, y task.
**Impacto:** Reduce sensación de "app explicándose". ~8 líneas.

---

## Qué NO tocar todavía

1. **Sync logic (`src/db/entries.ts`, `src/app/api/sync/`, `src/lib/sync/`)**: Cualquier cambio en `entry` shape puede romper sync. Si cambiamos `metadata`, asegurar que `sync` lo maneja. No tocar sin test de sync.

2. **`package.json`, `package-lock.json`, `next.config.mjs`**: Reglas de AGENTS.md. No tocar.

3. **Auth/Clerk (`src/middleware.ts`, `@clerk/nextjs`)**: No relacionado. No tocar.

4. **Landing page (`src/app/page.tsx`)**: No relacionado. No tocar.

5. **BottomNav**: No tocar a menos que sea parte de un rediseño mayor. Añadir/quitar tabs rompe muscle memory.

6. **`NoteEditor.tsx`**: No tocar hasta Fase 3. El auto-focus en mobile es molesto pero no crítico.

7. **`processInput` del orchestrator**: No tocar hasta leer `src/core/agents/orchestrator.ts`. Puede depender de `parser-rules.ts` de forma no obvia.

8. **Drizzle schema / DB migrations**: No tocar sin user approval. AGENTS.md lo prohíbe.

9. **OpenRouter integration**: No tocar hasta Fase 2C. Fase 2A y 2B deben estar estables primero.

10. **`NextBestAction`**: No tocar. Es funcional y no bloquea el radar.

---

## Primer prompt de implementación recomendado

> **"Fase 2A-Q1: Unificar intent guards y eliminar duplicación de reglas"**

**Scope:**
- Crear `src/core/agents/intent-guards.ts` que exporte: `isLongFormNote`, `hasShoppingIntent`, `hasPaymentIntent`, `hasHealthIntent`, `hasPetAction`, `hasProjectIntent`, `hasConceptualNoteIntent`, `hasIncomeIntent`, `hasPassiveExpenseIntent`, `hasExpensePurchaseIntent`, `hasExplicitListIntent`, `shouldBuildShoppingList`, `resolveListEntryType`
- Refactorizar `src/core/agents/parser-rules.ts` para que sea un re-export de `intent-guards.ts` (mantener backward compatibility)
- Refactorizar `src/core/display/surface-resolver.ts` para importar `isLongFormNote`, `hasShoppingIntent`, `hasHealthIntent`, `hasPetAction` desde `intent-guards.ts` en lugar de definir inline
- Refactorizar `src/core/display/display-rules.ts` para importar `isLongFormNote` desde `intent-guards.ts` en lugar de `isResearchOrLongDoc`
- Refactorizar `src/core/cognitive/normalize-radar-result.ts` para importar `hasShoppingIntent`, `hasPaymentIntent`, `hasHealthIntent`, `hasPetAction` desde `intent-guards.ts` (ya lo hace, solo verificar que los imports son correctos)
- Refactorizar `tests/radar-intake.test.mjs` para importar `FORBIDDEN_ITEM_WORDS`, `STORE_PATTERNS`, `TYPE_TO_SURFACE` desde archivos fuente (o crear un `src/core/agents/test-helpers.ts` para tests)
- Eliminar `reminder` de `TASK_AGENT` en `src/core/card-agents/task.agent.ts`
- Crear `CALENDAR_AGENT` en `src/core/card-agents/calendar.agent.ts` o eliminar `calendar` de `EntryTypeSchema` en `src/core/contracts/card-contracts.ts`

**Validación:**
- `npm run typecheck` debe pasar
- `npm run lint` debe pasar
- `node --experimental-strip-types tests/radar-intake.test.mjs` debe pasar
- La app debe compilar (`npm run build`)
- Prueba manual: escribir "comprar pan leche en minimarket" → clasifica como shopping_list
- Prueba manual: escribir "pago google one 21000" → clasifica como payment con monto
- Prueba manual: escribir "buscar vuelos diciembre 2026" → NO clasifica como payment, amount = null

**No incluir:**
- No cambiar `TimelineView.tsx` render
- No cambiar `UniversalInput.tsx`
- No añadir OpenRouter
- No cambiar DB schema
- No cambiar sync logic

---

## Resumen ejecutivo

**El radar está más sano de lo que parece.** La arquitectura dual (heurístico + normalizador) es correcta. `shouldUseAI` es conservador. El sanitizador es defensivo. Los tests cubren edge cases críticos.

**El problema principal es duplicación de reglas.** Las mismas intenciones están definidas en 4 lugares. Esto hace que el sistema sea frágil ante cambios y garantiza que `surface-resolver.ts` y `normalize-radar-result.ts` eventualmente diverjan.

**El problema secundario es UX de cards.** Las cards expanded inline destruyen la calma. La metadata excesiva en collapsed rompe el escaneo. La falta de Reader Mode unificado para todos los tipos genera inconsistencia.

**La solución no es más IA. Es menos ruido.** La IA (OpenRouter) debe venir en Fase 2C, después de limpiar reglas (2A) y después de permitir reclasificación manual (2B). Si metemos IA antes de limpiar el radar, la IA clasificará sobre un sistema sucio y los errores serán más difíciles de debuggear.

**Orden correcto:**
1. Fase 2A: Limpiar reglas → consolidar fuentes de verdad
2. Fase 2B: Reclasificación manual → dar poder al usuario
3. Fase 2C: IA opcional → refuerzo para casos ambiguos
4. Fase 2D: Cards inteligentes → mostrar menos, mejor
5. Fase 3: Notas avanzadas → sketchnoting, editor premium

**Primer paso:** Unificar `intent-guards.ts`. Es 1-2 horas de trabajo, elimina duplicación, y desbloquea todo lo demás.
