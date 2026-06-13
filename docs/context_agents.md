# Liev — Contexto para agentes

> Este archivo es la fuente de verdad para futuros agentes/sesiones.
> Mantenerlo actualizado después de cada cambio significativo.
> NO confundir con `docs/RADAR_AGENT.md` (que describe RADAR como capa de inteligencia ambiental).
> Este documento describe el estado operativo del sistema de clasificación semántica.

---

## Stack

- Framework: Next.js 14, TypeScript
- Storage: Dexie (local-first IndexedDB) + Neon/Drizzle (cloud sync)
- Auth: Clerk
- Parsing: pipeline heurístico local (safety → parseTokens → normalizeEntry)
- IA: OpenRouter (RADAR), desconectado del runtime por defecto

---

## Reglas permanentes para agentes

- Backend/lógica primero. No crear mocks que simulen el backend real.
- No crear otro RADAR paralelo. Existe `src/lib/radar.ts` → usar ese.
- No crear `src/lib/ai-card-parser` mientras exista `src/lib/radar.ts`.
- No instalar dependencias sin autorización explícita.
- No tocar `package.json` / `package-lock.json` salvo instrucción explícita.
- No tocar DB / migraciones / sync / theme si la tarea es parser o clasificación.
- Un solo flujo semántico activo por vez.
- Todo cambio debe tener tests y build pasando antes de considerar completo.
- No usar Zod por ahora — validación manual estricta.
- No hacer commit/push salvo instrucción explícita.

---

## Pipeline de clasificación

```
Texto usuario
  → safetyCheck()              [src/core/agents/safety-agent.ts]
  → parseTokens()              [src/core/agents/parser-agent.ts]
  → normalizeEntry()           [src/core/agents/normalizer-agent.ts]
  → addEntry()                 [src/db/entries.ts]
```

Con RADAR activo (flag `NEXT_PUBLIC_LIEV_RADAR_ENABLED=true`):

```
Texto usuario
  → radarIntake()              [src/lib/radar.ts] → POST /api/radar/intake
    ├── si confidence ≥ 0.75 → radarToEntry() → addEntry()
    └── si falla/timeout/baja confianza → fallback pipeline local
```

---

## RADAR — Estado operativo

| Archivo | Estado |
|---|---|
| `src/app/api/radar/intake/route.ts` | Existe, build OK, endpoint funcional |
| `src/lib/radar.ts` | Existe, validación + sanitizer + builder |
| `src/components/UniversalInput.tsx` | Integrado detrás de flag, OFF por defecto |

### Activar RADAR

Agregar en `.env.local`:
```
NEXT_PUBLIC_LIEV_RADAR_ENABLED=true
```
Reiniciar servidor de desarrollo (el valor se embebe en el bundle al inicio).

### Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `OPENROUTER_API_KEY` | API key server-side (nunca pública) |
| `OPENROUTER_MODEL` | Opcional, default: `google/gemini-flash-1.5` |
| `NEXT_PUBLIC_LIEV_RADAR_ENABLED` | Feature flag, default: desactivado |

---

## Riesgos activos

| Riesgo | Severidad | Estado |
|---|---|---|
| Latencia de red en submit (hasta 5s cuando RADAR activo) | Media | Aceptado — flag OFF por defecto |
| Modelo no soporta `response_format: json_object` → markdown wrapping | Media | Mitigado — extracción conservadora |
| `AbortSignal.timeout()` lanza `TimeoutError` no `AbortError` en Node 18+ | Media | Corregido 2026-06-03 |
| `pet`/`health` sin `ShoppingMetadata` → ítems no renderizan via shopping UI | Baja | Decisión consciente — renderizado via ChecklistItem records |
| `confidence` fuera de `[0,1]` | Baja | Mitigado — clamp en servidor y cliente |

---

## Decisiones de arquitectura tomadas

- **ShoppingMetadata solo para `shopping_list`**: `pet` y `health` NO reciben `ShoppingMetadata` desde RADAR para evitar que aparezcan en `/purchases`. Sus ítems se preservan como `ChecklistItem` records en Dexie.
- **`checklistItems` por tipo**: `shopping_list`, `pet`, `health` → sí. `note`, `payment`, `appointment`, `task` → no, aunque la IA devuelva items.
- **Sanitizer local obligatorio**: fechas, conectores y contexto de tienda se filtran en `sanitizeChecklistItems()` independientemente de lo que devuelva el modelo.
- **Validación manual sin Zod**: `validateRadarResult()` en `radar.ts`, validación adicional en `route.ts`.
- **IA propone, Liev valida**: el modelo clasifica, el código decide.

---

## Bitácora de cambios

### 2026-06-03 — RADAR OpenRouter fallback model + retry

**Problema:** `moonshotai/kimi-k2.6:free` devolvía 429 (rate-limit upstream), causando fallback abrupto sin retry.

**Cambio:** Agregado `OPENROUTER_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL`. Extraído helper `openRouterFetch(model, text, apiKey)` para evitar duplicar headers/body. Si primary falla con status retriable (400/404/429/502) y existe `OPENROUTER_FALLBACK_MODEL`, se intenta el fallback una sola vez. Si también falla → `200 ok:false`. Si no hay fallback configurado → `200 ok:false` inmediato. Nunca devuelve 502 por errores de provider.

**Logs dev-only:** `[radar] OpenRouter primary failed`, `[radar] OpenRouter fallback failed`, `[radar] fallback=heuristic`.

**No se tocó:** `radar.ts`, sync, UI, theme, parser heurístico, Dexie, DB, package.json.

**Validaciones:** typecheck OK, 188/188 tests, build OK.

### 2026-06-03 — RADAR OpenRouter config hardening

**Problema:** `/api/radar/intake` devolvía 502 porque usaba fallback `google/gemini-1.5-flash` inválido cuando `OPENROUTER_MODEL` no estaba disponible en runtime.

**Causa:** constante de módulo `const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'google/gemini-1.5-flash'` — fallback hardcodeado obsoleto.

**Cambios:**
- `route.ts`: `OPENROUTER_MODEL` sin fallback. Si falta key o modelo → 200 `{ok:false, source:'fallback', reason:'openrouter_not_configured'}`. Errores 400/401/403/404/429 del provider → 200 `{ok:false, source:'fallback', reason:'openrouter_provider_error'}`. Timeouts → 200 `{ok:false}`. Respuestas vacías/inválidas del modelo → 200 `{ok:false}`. Solo errores inesperados de servidor → 502/500.
- `radar.ts`: `radarIntake` verifica explícitamente `data.ok === false` y retorna null antes de `validateRadarResult`.

**No se tocó:** sync, UI, theme, parser heurístico, Dexie, DB schema, migraciones, package.json.

**Validaciones:** typecheck OK, 188/188 tests, build OK.

### 2026-06-03 — Fix sync push duplicate final rows

**Problema:** `/api/sync/push` fallaba con `NeonDbError: ON CONFLICT DO UPDATE command cannot affect row a second time`.

**Causa:** Después de resolver `canonicalCloudId`, el batch `entryRows`/`itemRows` podía contener más de una fila con el mismo `id`. El conflict target real de `upsertEntries` es `entries.id` (PK); cuando dos filas del mismo batch comparten ese id, PostgreSQL rechaza el comando completo.

**Cambio:** Agregado helper `dedupeRowsById` en `push/route.ts` que deduplica `entryRows` e `itemRows` por `row.id` justo antes del upsert, conservando la última versión. Log dev-only si se eliminaron duplicados. Response incluye campo `deduped` en dev.

**No se tocó:** UI, theme, RADAR, parser, OpenRouter, package.json, .env.local, schema, migraciones.

**Validaciones:** typecheck OK, 188/188 tests, build OK.

### 2026-06-03 (sesión 2)

**Qué se auditó:**
- `src/app/api/sync/push/route.ts` — resolución de canonicalCloudId
- `src/db/cloud/queries.ts` — upsertEntries, partial unique index
- `src/db/cloud/schema.ts` — entries_user_dedupe_key_active_idx
- `src/lib/sync/push.ts`, `src/lib/sync/dedupe.ts` — payload client-side
- `src/app/api/radar/intake/route.ts` — OpenRouter error logging
- `src/app/globals.css` — Calm Light theme tokens

**Causa real del /api/sync/push 500:**
El orden de resolución de `canonicalCloudId` en `push/route.ts` revisaba `existingEntryByLocalId` ANTES que `existingEntryByDedupeKey`. Cuando dos entradas locales tenían el mismo `dedupeKey` (duplicados semánticos que ya existían en la BD como filas separadas), ambas se resolvían a `canonicalCloudId`s distintos. El batch UPDATE intentaba asignar el mismo `dedupe_key` a dos filas activas, violando `entries_user_dedupe_key_active_idx` — error no capturado → 500 sistemático.

**Qué se cambió:**
- `src/app/api/sync/push/route.ts`: Invertido el orden de resolución — `existingEntryByDedupeKey` se consulta PRIMERO, luego `existingEntryByLocalId`. Esto garantiza que duplicados semánticos resuelvan al mismo `canonicalCloudId` y el batch UPDATE no viole el índice parcial.
- `src/app/api/radar/intake/route.ts`: Agregado logging del error body de OpenRouter (dev-only, sin exponer API key) para diagnosticar el 502.
- `src/app/globals.css`: Ajustados tokens del Calm Light theme (card bg, border, text-primary/secondary/muted, shadow, bg-surface) para mayor legibilidad y sensación otoñal.

**Qué NO se cambió:**
- `src/db/cloud/queries.ts` (upsertEntries, fallback path)
- Parser heurístico, normalizer, safety-agent
- DB, migraciones, Dexie schema
- `package.json`, `package-lock.json`, `.env.local`

**Validaciones ejecutadas:**
- `npm run typecheck` → OK
- `node --experimental-strip-types --test tests/*.test.mjs` → 188 passing
- `npm run build` → OK

**Riesgos residuales:**
- El RADAR 502 necesita verificar en terminal de desarrollo qué devuelve OpenRouter tras el logging. El ID de modelo `google/gemini-flash-1.5` puede ser incorrecto para OpenRouter (verificar en openrouter.ai/models).
- Entradas huérfanas con `dedupe_key=NULL` en la BD quedan sin limpiar — se irán resolviendo en futuros pushes.

### 2026-06-03

**Qué se auditó:**
- `src/lib/radar.ts` y `src/app/api/radar/intake/route.ts`
- Estado de integración con `UniversalInput.tsx`
- Comportamiento de `pet`/`health` + `ShoppingMetadata`
- Validación de campos del schema RADAR

**Qué se cambió:**
- `src/lib/radar.ts`: agregados `isValidRadarType`, `isValidSurface`, `isValidPriority`, `isValidStatus`, `clampConfidence`, `sanitizeChecklistItems`, `validateRadarResult`. Corregida asignación de `ShoppingMetadata` (solo `shopping_list`). Corregida asignación de `checklistItems` (solo tipos lista). Sanitizer defensivo post-validación.
- `src/app/api/radar/intake/route.ts`: corregido `AbortError` → `TimeoutError`. Agregada validación de enums. Agregada extracción conservadora de JSON desde markdown. Clamp de `confidence`. Validación de `amount >= 0`. Filtrado de arrays de strings.
- `src/components/UniversalInput.tsx`: integración RADAR detrás de flag `NEXT_PUBLIC_LIEV_RADAR_ENABLED`.
- `tests/radar-intake.test.mjs`: tests de sanitizer, validación, tipos por categoría.
- `docs/context_agents.md`: creado.

**Qué NO se cambió:**
- `normalizer-agent.ts`, `parser-agent.ts`, `list-builder-agent.ts`
- DB, migraciones, sync, theme
- `package.json`, `package-lock.json`
- `.env.local`

**Validaciones ejecutadas:**
- `npm run build` → OK
- `node --experimental-strip-types --test tests/*.test.mjs` → todos passing

**Riesgos pendientes:**
- Verificar manualmente que entradas `pet`/`health` con ítems muestren ChecklistItems correctamente en su vista (no en `/purchases`).
- Medir latencia real de OpenRouter en producción con el flag activo.

## Fase futura — Contexto visual multimodal en Liev

Objetivo:
Permitir que Liev recuerde y recupere referencias visuales del usuario sin sobrecargar la base de datos.

Casos de uso:
- “Muéstrame una foto de cuando era niño”
- “Mándame el mockup de la UI de AMON Shop”
- “Muéstrame la UI/UX de la web de Liev que habíamos agregado”
- “Busca el screenshot donde hablamos del perfil claro”
- “Muéstrame la referencia visual del theme Calm Light”

Principio técnico:
Liev NO almacenará imágenes pesadas directamente en la BD.
Liev almacenará metadata, contexto semántico y referencias externas.

Estrategia:
1. Google Photos / Google Drive como almacenamiento visual principal.
2. Liev guarda solo:
   - title
   - description
   - tags
   - memoryType: photo | screenshot | mockup | document | ui_reference
   - sourceProvider: google_photos | google_drive | local | github
   - externalId / url / fileRef
   - createdAt
   - relatedProject: Liev | HEO | AMON Shop | TBB | AMON 360
   - semanticSummary
3. Más adelante, agregar búsqueda semántica/visual por texto.
4. No integrar esto hasta que Sync + RADAR + cards estén estables.

No hacer todavía:
- No subir imágenes a Neon/Postgres.
- No guardar base64 en la BD.
- No crear embeddings visuales todavía.
- No mezclar esto con el parser principal.

# Liev — Roadmap operativo y contexto para agentes

Pensado durante 19sPerfecto. Te dejo un bloque completo y limpio para pegar directo en docs/context_agents.md.
Lo ordené como roadmap operativo, no como humo de “algún día haremos IA mágica de los Power Rangers”. Está pensado para que cualquier agente futuro entienda:


qué es Liev,


qué NO debe tocar,


qué ya se conversó,


qué va primero,


qué queda después,


cómo convive con HEO,


cómo entra RADAR,


cómo manejar memoria visual sin reventar la BD.


Copia desde aquí:
# Liev — Roadmap operativo y contexto para agentes> Fuente de verdad para futuras sesiones/agentes.> Mantener actualizado después de cada cambio significativo.> Este documento describe el estado operativo, decisiones de arquitectura, prioridades y límites del proyecto Liev / Minilib.> No confundir con `docs/RADAR_AGENT.md`, que describe RADAR como capa de inteligencia semántica.> Este documento es el mapa general del producto y su evolución dentro del ecosistema AMON.---## 1. Identidad del productoLiev es una libreta tranquila para lo cotidiano.No debe sentirse como:- dashboard enterprise- Notion pesado- app de productividad ansiosa- CRM personal- demo visual sin backend real- simulación de IADebe sentirse como:- una libreta calma- una segunda memoria contextual- una interfaz humana- un sistema local-first- una app simple que entiende intención cotidiana- un puente suave hacia otros módulos del ecosistema AMONFrase guía:> Liev organiza lo cotidiano sin obligar al usuario a organizar su vida manualmente.---## 2. Principio rector actualPrioridad absoluta:1. Backend / datos / sync primero.2. Flujo real antes que mockup.3. Cambios pequeños y verificables.4. No tocar tres sistemas al mismo tiempo.5. No romper Dexie/local-first.6. No duplicar lógica RADAR.7. No crear nuevos parsers sin justificar.8. Registrar cada cambio en este documento.Regla crítica:> Si el cambio no mejora comportamiento real del usuario, no se implementa todavía.---## 3. Estado actual resumidoStack actual:- Framework: Next.js 14- Lenguaje: TypeScript- Storage local: Dexie / IndexedDB- Sync remoto: NeonDB + Drizzle- Auth: Clerk- IA/RADAR: endpoint `/api/radar/intake`- Provider IA previsto: OpenRouter- Fallback: parser heurístico local- UI: mobile-first, PWA, theme Calm Dark / Calm LightScripts relevantes:```bashnpm run devnpm run buildnpm run typechecknode --experimental-strip-types --test tests/*.test.mjs
Validaciones recientes conocidas:
npm run build# OKnode --experimental-strip-types --test tests/*.test.mjs# OK en última validación reportada

4. Decisión importante: Liev y HEO son apps distintas
Liev y HEO Sentinel NO son la misma app.
Relación correcta:
Liev = libreta / memoria cotidiana / contexto / organización suaveHEO = bienestar / salud / orientación / asistencia emocional y preventivaAMON = ecosistema mayor donde ambas conviven
Liev puede detectar contexto de salud, pero no debe intentar transformarse en HEO.
Ejemplo futuro:
Si el usuario tiene una card:
Ir al médico mañana a las 15:00
Liev puede mostrar:
¿Quieres preparar esta cita con HEO?
Y abrir un enlace hacia HEO Sentinel.
Eso NO se implementa todavía. Queda como fase futura.

5. Roadmap general por fases
Fase 0 — Estabilidad base
Estado: en curso / prioridad máxima.
Objetivo:
Asegurar que Liev no pierda datos, no duplique entradas y no rompa sync.
Prioridades:


Corregir errores 500 en /api/sync/push.


Evitar duplicados en entries.


Evitar duplicados en items.


Manejar correctamente conflictos ON CONFLICT DO UPDATE.


Validar que pull y push funcionen con Dexie + Neon.


No tocar UI mientras existan errores de sync relevantes.


Criterio de éxito:
/api/sync/pull 200/api/sync/push 200sin duplicados por idsin reinsertar filas repetidassin pérdida de entradas locales
No hacer:


No rediseñar.


No meter nuevas features.


No integrar más IA.


No tocar themes.


No crear más documentos sueltos.



Fase 1 — RADAR semántico estable
Estado: en curso.
Objetivo:
Usar RADAR como clasificador semántico real, no como simulación visual.
RADAR debe resolver problemas del parser heurístico:


“sábado comprar pan queso bebida” no debe tomar sábado como item.


Las fechas nunca deben entrar como checklist items.


Las compras deben generar shopping_list.


Los pagos deben generar payment.


Las citas deben generar appointment.


Las mascotas deben generar pet.


Las notas deben quedar como note.


Si la IA falla, debe caer al parser local sin romper la app.


Arquitectura actual esperada:
input usuario    ↓RADAR intake    ↓ si IA disponible y válidarespuesta semántica estructurada    ↓normalización local    ↓ParsedEntry    ↓Dexie    ↓sync remoto
Fallback esperado:
input usuario    ↓RADAR falla / provider no configurado / timeout / JSON inválido    ↓parser heurístico local    ↓ParsedEntry source: heuristic/local
Regla crítica:

RADAR no reemplaza la app. RADAR solo mejora clasificación.

No hacer:


No meter embeddings todavía.


No guardar conversaciones completas.


No depender obligatoriamente de OpenRouter.


No bloquear creación de cards si RADAR falla.


No crear otro módulo paralelo llamado ai-card-parser si ya existe RADAR consolidado.



Fase 2 — Provider IA: OpenRouter primero, Ollama después
Estado: parcialmente configurado.
Decisión:


En MacBook con poco espacio: NO LM Studio como base.


LM Studio queda descartado para esta fase por peso.


OpenRouter se usa para pruebas rápidas vía API.


Ollama queda como opción local futura, idealmente en PC gamer o entorno más robusto.


Variables esperadas:
NEXT_PUBLIC_LIEV_RADAR_ENABLED=trueOPENROUTER_API_KEY=...OPENROUTER_MODEL=moonshotai/kimi-k2.6:free
Importante:


No usar modelos inválidos como google/gemini-1.5-flash en OpenRouter si OpenRouter responde 400.


Si el modelo falla, RADAR debe retornar fallback, no romper.


No exponer API keys en logs.


No imprimir .env.


No imprimir payload completo si contiene datos sensibles.


Estrategia recomendada:
OpenRouter = RADAR remoto livianoOllama = futuro modo local / offline / privacidad avanzadaHeurístico = fallback obligatorio
Futuro:


Soporte provider:


openrouter


ollama


disabled




Config por env:


LIEV_RADAR_PROVIDER=openrouter | ollama | disabled


LIEV_RADAR_TIMEOUT_MS=4000


LIEV_RADAR_MODEL=...





Fase 3 — Normalización de cards
Estado: pendiente / crítica.
Objetivo:
Que las cards se muestren de forma coherente según tipo real.
Tipos principales:
notetaskshopping_listpaymenthealthpetappointmenthomeidea
Reglas:
Compras
Entrada:
compras hoy en supermercado pan, leche, bebida, choclos total 7330
Resultado esperado:
type: shopping_listtitle: Lista de comprasstoreType: supermercadodate: hoyitems:  - pan  - leche  - bebida  - choclosamount/totalCompra: 7330 solo si corresponde como total de compra
No hacer:


No guardar total 7330 como item.


No guardar fechas como items.


No dejar todo como “Lista de compras” genérica si se puede inferir contexto.


Store types sugeridos:
supermercadofarmaciaferiaminimarketbotilleriamallmall_chinopanaderiacarniceriaverduleriaotro
Pagos
Entrada:
pago mensualidad escuela hijo 15000
Resultado esperado:
type: paymenttitle: Pagar mensualidad escuela hijoamount: 15000direction: expensestatus: pending
No debe quedar como note.
Salud
Entrada:
medico el dia martes a las 15:30
Resultado esperado:
type: appointment o health según intencióncategory: healthdate: martestime: 15:30title: Médico
Futuro:
Mostrar CTA hacia HEO:
Preparar cita con HEO
Mascotas
Entrada:
hora veterinaria para Saly sábado 15:30
Resultado esperado:
type: pettitle: Hora veterinaria para Salydate: sábadotime: 15:30
No debe entrar como health humano.

Fase 4 — Vista de cards inteligente, sin rediseño masivo
Estado: pendiente.
Objetivo:
Mejorar cómo se muestran las cards sin rehacer toda la UI.
Principios:


Mantener diseño actual.


Mejorar legibilidad.


Diferenciar bien tipos.


No ocultar información importante.


Evitar textos de ayuda repetidos que ensucian la card.


No llenar de badges innecesarios.


Cards deben mostrar:
tipotítulofecha si existehora si existemonto si existeitems si correspondeestado si correspondefuente si es útil: IA / local
No mostrar siempre:
“Si no es una lista de compras...”“Si es una tarea...”
Ese texto debe reducirse o aparecer solo en modo debug/desarrollo.

Fase 5 — Shopping Completion Flow
Estado: idea validada / no implementar todavía.
Objetivo:
Cuando una shopping_list tenga items marcados, permitir registrar el total de compra.
Flujo futuro:
Usuario crea shopping_list    ↓Marca items comprados    ↓Botón: Registrar total    ↓Ingresa monto CLP    ↓Guardar metadata.totalCompra    ↓Crear movimiento financiero tipo egreso    ↓source: shopping_list    ↓linkedEntryId: id de la card    ↓Descontar saldo disponible    ↓Evitar duplicar egreso si ya existe linkedEntryId
Ejemplo:
Lista supermercado:- pan- leche- bebida- choclosTotal compra: $7.330
Debe reflejarse en Finanzas:
egreso: $7.330origen: shopping_listlinkedEntryId: <entry-id>
Reglas críticas:


No crear egreso duplicado.


No descontar dos veces.


No usar texto libre como única fuente.


No mezclar total con checklist item.


No implementar hasta que sync esté estable.



Fase 6 — Finanzas conectadas a acciones reales
Estado: pendiente.
Objetivo:
Que Finanzas no sea solo pantalla bonita, sino resumen de movimientos reales.
Movimientos posibles:
payment manualshopping totalingreso manualegreso manualsuscripcióncuenta fija
Campos recomendados:
{  id: string;  type: "income" | "expense";  title: string;  amount: number;  status: "pending" | "paid";  source: "manual" | "payment_card" | "shopping_list";  linkedEntryId?: string;  createdAt: string;  paidAt?: string;}
Regla:

Toda acción que afecte dinero debe tener trazabilidad.

No hacer:


No descontar saldo desde texto sin confirmación.


No crear movimientos duplicados.


No mezclar gastos pendientes con gastos pagados sin estado claro.



Fase 7 — Themes Calm Dark / Calm Light
Estado: implementado parcialmente, requiere ajuste visual.
Objetivo:
Tener un sistema visual premium y calmado sin afectar lógica.
Themes:
Calm Dark
Debe sentirse:


negro mate


cálido


profundo


con partículas suaves


sin glow molesto


sin fondo “sucio”


legible


Problemas detectados:


Hay brillo de fondo que molesta.


Algunas cards se ven demasiado opacas.


La UI perdió algo de la intención original.


El fondo no debe competir con el texto.


Ajuste deseado:
menos glowmás matepartículas sutilesborde cálido/dorado tenue en cardsmejor contraste de texto secundario
Calm Light
Debe sentirse:


papel premium mate


cálido


levemente otoñal


beige suave


no blanco quemado


legible


humano


Problemas detectados:


Demasiado claro.


Algunas tipografías se pierden.


Las cards necesitan borde más visible.


Falta tono cálido tipo atardecer/otoñal.


Ajuste deseado:
fondo más opaco/cálidocards con borde dorado suavetexto secundario más contrastadomenos transparencia en cardssin parecer dashboard enterprise
Regla:

El theme no debe sacrificar legibilidad por estética.

No hacer:


No meter cyberpunk.


No glow exagerado.


No animaciones pesadas.


No refactorizar toda la app por theme.


No tocar parser/sync al ajustar theme.



Fase 8 — Handoff Liev → HEO
Estado: roadmap futuro.
Objetivo:
Permitir que ciertas cards de salud/bienestar abran una experiencia en HEO Sentinel.
Casos:
Ir al médicoTomar remedioTerapiaControl médicoSíntomasUrgencia emocionalCita veterinaria futura si HEO PET existe
Ejemplo de CTA:
Preparar con HEO
Acción:
Liev pasa contexto mínimo:- title- date- time- type- notes
HEO recibe:
modo: preparación de cita / orientación bienestar
No implementar todavía.
Condición previa:


Cards health/pet/appointment deben estar bien clasificadas.


Sync estable.


RADAR estable.


HEO debe tener endpoint claro de recepción o deep link.



Fase 9 — Contexto visual multimodal
Estado: roadmap futuro.
Objetivo:
Permitir que Liev recuerde y recupere referencias visuales del usuario sin sobrecargar la base de datos.
Casos de uso:
Muéstrame una foto de cuando era niñoMándame el mockup de la UI de AMON ShopMuéstrame la UI/UX de la web de Liev que habíamos agregadoBusca el screenshot donde hablamos del perfil claroMuéstrame la referencia visual del theme Calm Light
Decisión técnica:
Liev NO debe guardar imágenes pesadas directamente en la BD.
Liev debe guardar:
metadatacontexto semánticoreferencia externatagsdescripciónproveedor
Almacenamiento recomendado:
Google Photos = memoria personal visualGoogle Drive = memoria visual de proyectosGitHub docs/design/references = referencias técnicas/versionadas/public = assets públicos pequeños
Ejemplo de registro:
{  "type": "visual_memory",  "title": "Mockup Calm Light de Liev",  "memoryType": "ui_reference",  "relatedProject": "Liev",  "sourceProvider": "google_drive",  "externalRef": "drive_file_id",  "tags": ["theme", "calm-light", "ui", "mockup"],  "semanticSummary": "Referencia visual del theme claro tipo papel premium mate para Home/Profile.",  "createdAt": "2026-06-03"}
No hacer todavía:


No subir imágenes a Neon/Postgres.


No guardar base64 en la BD.


No crear embeddings visuales todavía.


No mezclar esto con el parser principal.


No usar almacenamiento local pesado en móvil.


Orden futuro:
1. índice visual manual2. links Google Drive / Photos3. búsqueda por texto4. resumen semántico5. embeddings después, si hay necesidad real

Fase 10 — Memoria contextual / segunda memoria
Estado: concepto central.
Liev debe evolucionar como segunda memoria contextual, semántica y emocional.
Esto NO significa que Liev lea todo ni guarde todo.
Significa que Liev puede registrar:
qué era importantepor qué era importantea qué proyecto pertenecequé acción siguequé recuerdo/contexto lo acompaña
Tipos de memoria futura:
task_memoryvisual_memoryproject_memoryhealth_contextfinancial_contextpersonal_notedecision_log
Ejemplo:
“recordar que el theme claro debe sentirse otoñal, no blanco quemado”
Debe convertirse en:
{  "type": "project_memory",  "project": "Liev",  "topic": "theme",  "summary": "El theme claro debe sentirse cálido/otoñal y no blanco quemado.",  "priority": "medium"}
No implementar aún como embeddings.
Primero:


cards correctas


sync estable


RADAR confiable



6. Reglas permanentes para agentes
Regla 1 — No crear otro RADAR
Ya existe RADAR como concepto operativo.
No crear:
ai-card-parsersmart-parsernew-radarradar-v2semantic-parser-extra
sin justificar y sin migración explícita.
Si hace falta mejorar, mejorar el RADAR existente.

Regla 2 — No tocar todo junto
Prohibido hacer en un mismo cambio:
sync + radar + theme + UI + database + tests
Orden correcto:
1 problema1 módulo1 validación1 registro en context_agents.md

Regla 3 — No romper local-first
Dexie/local-first es parte central.
No hacer:


reemplazar Dexie sin plan


depender de servidor para crear cards


bloquear uso offline


obligar IA para guardar entradas


romper IndexedDB



Regla 4 — No simular backend
No crear UI que parezca funcional si no existe flujo real.
Si algo es mock:
Debe decir:
mockplaceholderfase futurano conectado todavía

Regla 5 — Registrar cambios
Después de cada cambio importante, actualizar este archivo con:
## Bitácora de cambios### 2026-06-03 Cambios realizados:- ...Archivos tocados:- ...Validaciones ejecutadas:- ...Pendientes:- ...

7. Validaciones obligatorias por tipo de cambio
Si se toca sync
Ejecutar:
npm run typechecknpm run build
Validar en consola:
/api/sync/pull 200/api/sync/push 200sin 500sin duplicados

Si se toca RADAR
Ejecutar:
npm run typechecknpm run buildnode --experimental-strip-types --test tests/radar-intake.test.mjsnode --experimental-strip-types --test tests/parsing-and-dedupe.test.mjs
Probar manualmente:
sábado comprar pan queso bebidacompras hoy en supermercado pan leche bebida choclos total 7330pago mensualidad escuela hijo 15000medico el dia martes a las 15:30hora veterinaria para saly sábado 15:30lleva ofrenda a la iglesia de comida no perecible este domingo

Si se toca theme/UI
Ejecutar:
npm run build
Validar:
Home legible en darkHome legible en lightcards legiblesinput usablebottom nav no tapadomobile 390/400 px OKSafari/iOS friendly
No tocar parser ni sync en cambios visuales.

Si se toca cards
Ejecutar:
npm run typechecknpm run buildnode --experimental-strip-types --test tests/display-rules.test.mjsnode --experimental-strip-types --test tests/card-agents.test.mjs
Validar:
shopping_list muestra itemspayment muestra montoappointment muestra fecha/horapet no cae como health humanonote no genera checklist

8. Bugs/pendientes conocidos
Pendiente 1 — RADAR OpenRouter 400 / 502
Problema observado:
OpenRouter error 400modelo inválido o no disponible/api/radar/intake 502
Acción:


Validar OPENROUTER_MODEL.


Confirmar modelo disponible.


Si falla, fallback local.


No bloquear creación de card.



Pendiente 2 — Sync duplicado / conflicto
Problema observado anteriormente:
ON CONFLICT DO UPDATE command cannot affect row a second time
Acción:


Dedupe por id antes de upsert.


Dedupe items por id.


No enviar filas repetidas.


Mantener logs resumidos, no payload completo.


Estado reciente:
/api/sync/push 200 observado después de dedupe
Seguir monitoreando.

Pendiente 3 — Store type en compras
Actualmente muchas compras quedan genéricas como:
Lista de comprasOtro
Mejorar inferencia:
supermercadofarmaciaferiaminimarketbotilleriamallmall_chinopanaderiacarniceriaverduleriaotro

Pendiente 4 — Theme claro y oscuro
Ajustar:
Calm Light:- más cálido- menos blanco quemado- mejor borde de cards- más contrasteCalm Dark:- menos brillo/glow- más mate- partículas más sutiles- mejor legibilidad

9. Roadmap ejecutivo resumido
Orden recomendado de avance:
1. Sync 100% estable2. RADAR intake sin romper fallback3. Clasificación correcta de cards4. Display rules por tipo5. Store type en compras6. Theme visual legible y calmado7. Shopping Completion Flow8. Finanzas conectadas a compras/pagos reales9. Handoff Liev → HEO10. Contexto visual multimodal11. Google Drive / Google Photos12. Memoria semántica avanzada13. Ollama/local agent futuro

10. Filosofía final
Liev no necesita parecer inteligente.
Necesita ser útil.
La inteligencia debe sentirse como:
menos fricciónmenos duplicadosmenos pasosmenos ansiedadmás claridadmás memoriamás calma
No como:
más botonesmás dashboardsmás promesasmás mocksmás capas rotas
Frase final de producto:

Liev es una libreta tranquila con memoria contextual: captura lo cotidiano, lo ordena sin ruido y abre el camino hacia bienestar, finanzas y contexto visual cuando el usuario realmente lo necesita.

## Fase futura — Shopping Receipt Flow

Objetivo:
Permitir que una lista de compras pueda adjuntar una boleta/foto, extraer texto mediante OCR, transformar el contenido en JSON validado y opcionalmente generar un PDF exportable.

Flujo deseado:
1. Usuario completa una shopping_list.
2. Usuario presiona “Adjuntar boleta”.
3. Usuario toma foto o sube imagen.
4. Sistema ejecuta OCR.
5. Sistema genera ReceiptData JSON.
6. Zod valida estructura.
7. Usuario confirma/corrige total, comercio e items.
8. Sistema guarda metadata en DB.
9. Sistema vincula receipt con linkedEntryId.
10. Sistema puede crear egreso en payments si no existe uno previo.
11. Sistema puede generar PDF descargable con resumen de compra.

Reglas:
- No guardar imágenes pesadas directamente en DB.
- Guardar solo imageRef/pdfRef + rawText + JSON validado.
- No confiar directamente en OCR.
- No descontar saldo sin confirmación del usuario.
- No duplicar egreso si ya existe linkedEntryId.
- Mantener flujo local-first.
- Google Drive será preferido para boletas/PDF.
- Google Photos queda reservado para memoria visual personal/contextual.

Tipo sugerido:
ReceiptData

Pendiente:
- Evaluar tesseract.js para OCR local.
- Evaluar pdf-lib o jspdf para generación de PDF.
- Diseñar UI mínima de “Adjuntar boleta”.
- Definir storage strategy.
- Conectar con payments.

## Fase futura — Shopping Receipt Flow

Objetivo:
Permitir que una lista de compras pueda adjuntar una boleta/foto, extraer texto mediante OCR, transformar el contenido en JSON validado y opcionalmente generar un PDF exportable.

Flujo deseado:
1. Usuario completa una shopping_list.
2. Usuario presiona “Adjuntar boleta”.
3. Usuario toma foto o sube imagen.
4. Sistema ejecuta OCR.
5. Sistema genera ReceiptData JSON.
6. Zod valida estructura.
7. Usuario confirma/corrige total, comercio e items.
8. Sistema guarda metadata en DB.
9. Sistema vincula receipt con linkedEntryId.
10. Sistema puede crear egreso en payments si no existe uno previo.
11. Sistema puede generar PDF descargable con resumen de compra.

Reglas:
- No guardar imágenes pesadas directamente en DB.
- Guardar solo imageRef/pdfRef + rawText + JSON validado.
- No confiar directamente en OCR.
- No descontar saldo sin confirmación del usuario.
- No duplicar egreso si ya existe linkedEntryId.
- Mantener flujo local-first.
- Google Drive será preferido para boletas/PDF.
- Google Photos queda reservado para memoria visual personal/contextual.

Tipo sugerido:
ReceiptData

Pendiente:
- Evaluar tesseract.js para OCR local.
- Evaluar pdf-lib o jspdf para generación de PDF.
- Diseñar UI mínima de “Adjuntar boleta”.
- Definir storage strategy.
- Conectar con payments.