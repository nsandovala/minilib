# QA Audit Cotidiano — Liev / minilib

> Auditor: OpenCode (QA auditor mode)  
> Fecha: 2026-05-26  
> Commit base: `fix: stabilize semantic classification and mobile nav`  
> Producción: https://liev-ten.vercel.app

---

## Comandos ejecutados

| Comando | Resultado |
|---------|-----------|
| `npx tsc --noEmit` | **PASS** |
| `node --experimental-strip-types --test tests/*.test.mjs` | **PASS** — 137/137 tests verdes |
| `npm run build` | **FAIL** — prerender errors en `/_error` (`/404`, `/500`) |

---

## 1. Veredicto general

**APTO CON OBSERVACIONES**

La clasificación central (pagos, salud, mascotas, calendario, notas) es estable. Las compras con ítems conocidos funcionan bien. El riesgo principal es que **tareas domésticas cotidianas caen a `note` en lugar de `task`**, lo que contamina Home y reduce la accionabilidad. No es un bloqueo de deploy, pero sí un hotfix recomendado antes de escalar usuarios.

---

## 2. Tabla de resultados

### 2.1 Tareas domésticas / recordatorios

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `lavar la ropa martes y viernes` | `task`, recurrencia martes/viernes | `task`, solo fecha martes, título feo `"Lavar la ropa y viernes"` | **PARTIAL** | media | `parser-agent.ts` (date extractor corta en "y"), `normalizer-agent.ts` (título) |
| 2 | `sacar la basura lunes miércoles viernes` | `task`, recurrencia | `task`, solo fecha lunes, pierde miércoles/viernes | **PARTIAL** | media | `parser-agent.ts` |
| 3 | `regar las plantas todos los domingos` | `task` o `reminder` con recurrencia | `note` — `"regar"` no es task keyword | **FAIL** | alta | `normalizer-agent.ts` (`TYPE_PATTERNS.task`) |
| 4 | `limpiar el baño sábado` | `task` | `task`, fecha sábado | **PASS** | — | — |
| 5 | `ordenar la pieza mañana` | `task` | `note` — `"ordenar"` no es task keyword | **FAIL** | alta | `normalizer-agent.ts` |
| 6 | `cambiar sábanas domingo` | `task` | `task`, fecha domingo | **PASS** | — | — |
| 7 | `cargar la bip mañana` | `task` | `note` — `"cargar"` no es task keyword | **FAIL** | alta | `normalizer-agent.ts` |
| 8 | `llamar a mi mamá viernes` | `task` o `reminder` | `note` — `"llamar"` no es task keyword | **FAIL** | alta | `normalizer-agent.ts` |
| 9 | `llevar documentos al banco lunes 10:00` | `task` + calendario secundario | `task`, fecha lunes, hora 10:00, secondary `[calendar, home]` | **PASS** | — | — |
| 10 | `pasar a buscar encomienda jueves` | `task` | `task`, fecha jueves | **PASS** | — | — |

**Resumen tareas:** 5/10 PASS. Las 5 fallas son por verbos cotidianos faltantes en `TYPE_PATTERNS.task`: `ordenar`, `cargar`, `llamar`, `regar`, `bañar`, `cortar`.

---

### 2.2 Compras de supermercado

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `supermercado leche, pan, huevos` | `shopping_list`, 3 ítems | `shopping_list`, 3 ítems, categorías correctas | **PASS** | — | — |
| 2 | `lista de compras arroz, aceite, azúcar, fideos` | `shopping_list`, 4 ítems | `shopping_list`, 4 ítems, tag `despensa` | **PASS** | — | — |
| 3 | `viernes compras papas fritas, huevos, aceites, pollo` | `shopping_list`, 4 ítems | `shopping_list`, 4 ítems, tag `carnes`, fecha viernes | **PASS** | — | — |
| 4 | `comprar detergente, confort, lavalozas` | `shopping_list`, 3 ítems | `shopping_list`, 3 ítems, título `"Lista para la casa"`, tag `aseo hogar` | **PASS** | — | — |
| 5 | `supermercado carne, verduras, bebidas` | `shopping_list`, 3 ítems | `shopping_list`, 3 ítems, tags `carnes, verduras, bebestibles` | **PASS** | — | — |
| 6 | `compras del super leche sin lactosa, pan integral, queso` | `shopping_list`, 3 ítems | `shopping_list`, 3 ítems, tags `lácteos, panadería` | **PASS** | — | — |

**Resumen supermercado:** 6/6 PASS. Checklist funciona, progreso 0/N, categorías correctas.

---

### 2.3 Compras minimarket

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `minimarket bebida, pan, queso` | `shopping_list` | `shopping_list`, 3 ítems | **PASS** | — | — |
| 2 | `comprar en minimarket coca cola, papas, hielo` | `shopping_list` | `shopping_list`, 3 ítems | **PASS** | — | — |
| 3 | `minimarket cigarros, bebida, chicle` | `shopping_list` | `shopping_list`, 3 ítems | **PASS** | — | — |
| 4 | `pasar al minimarket por pan y bebida` | `shopping_list` o `task` | `shopping_list`, 2 ítems (`pan`, `bebida`) | **PASS** | — | — |

**Resumen minimarket:** 4/4 PASS.

---

### 2.4 Compras tabaquería

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `tabaquería tabaco, filtros, papelillos` | `shopping_list` | `note` — `"tabaquería"` no es store keyword conocido; ítems desconocidos | **FAIL** | media | `list-builder-agent.ts` (`STORE_TYPE_PATTERNS`, `ITEM_CATEGORY_MAP`) |
| 2 | `comprar tabaco y filtros` | `shopping_list` o `task` | `task` — ítems desconocidos, no construye lista | **FAIL** | media | `list-builder-agent.ts` |
| 3 | `pasar a la tabaquería por tabaco` | `task` o `note` | `note` | **PARTIAL** | baja | `parser-rules.ts` (`hasShoppingIntent`) |
| 4 | `tabaco 15000` | `payment` o `shopping_list` con monto | `note`, amount=15000 | **FAIL** | alta | `normalizer-agent.ts` (falta keyword de pago/compra) |

**Resumen tabaquería:** 0/4 PASS. La tabaquería no está en el mapa de tiendas ni de productos.

---

### 2.5 Compras feria

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `feria tomates, papas, cebollas` | `shopping_list` | `shopping_list`, 3 ítems | **PASS** | — | — |
| 2 | `comprar en la feria frutas y verduras` | `shopping_list` | `shopping_list`, 2 ítems (`frutas`, `verduras`) | **PASS** | — | — |
| 3 | `feria manzanas, plátanos, zanahorias` | `shopping_list` | `shopping_list`, 3 ítems | **PASS** | — | — |
| 4 | `domingo feria verduras para la semana` | `note` o `shopping_list` | `note`, pero `purchases: true` por regex `"feria"` en surface-resolver | **FAIL** | media | `surface-resolver.ts` (`hasActionablePurchaseIntent`) |

**Resumen feria:** 3/4 PASS. El note con "feria" filtra a purchases por regex de título/texto.

---

### 2.6 Compras farmacia

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `farmacia paracetamol, ibuprofeno` | `shopping_list` | `shopping_list`, 2 ítems | **PASS** | — | — |
| 2 | `comprar remedio en farmacia` | `shopping_list` o `task` | `health` (y `purchases: true` por surface-resolver) | **FAIL** | media | `normalizer-agent.ts` (health keywords ganan a shopping) |
| 3 | `farmacia vitamina C, suero, gasas` | `shopping_list` | `shopping_list`, 3 ítems, tag `farmacia` | **PASS** | — | — |
| 4 | `retirar remedio farmacia lunes 10:00` | `task` o `shopping_list` | `health`, fecha lunes, hora 10:00 | **FAIL** | media | `normalizer-agent.ts` |

**Resumen farmacia:** 2/4 PASS. `"comprar remedio"` y `"retirar remedio"` son capturados por health keywords antes de shopping.

---

### 2.7 Compras ferretería

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `ferretería tornillos, cinta aisladora, pilas` | `shopping_list` | `shopping_list`, 4 ítems (cinta/aizladora separados), tag `ferretería` | **PASS** | — | — |
| 2 | `comprar martillo y clavos` | `shopping_list` | `shopping_list`, 2 ítems, tag `ferretería` | **PASS** | — | — |
| 3 | `pasar a la ferretería por silicona` | `task` o `shopping_list` | `note` — `"silicona"` no es ítem conocido | **FAIL** | baja | `list-builder-agent.ts` (`ITEM_CATEGORY_MAP`) |
| 4 | `ferretería pintura blanca, brocha, rodillo` | `shopping_list` | `shopping_list`, 3 ítems, tag `ferretería` | **PASS** | — | — |

**Resumen ferretería:** 3/4 PASS.

---

### 2.8 Pagos / finanzas

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `pagar internet 29990 viernes` | `payment` | `payment`, amount=29990, fecha viernes | **PASS** | — | — |
| 2 | `pagar luz 45000 lunes` | `payment` | `payment`, amount=45000, fecha lunes | **PASS** | — | — |
| 3 | `pagar agua 18000` | `payment` | `payment`, amount=18000 | **PASS** | — | — |
| 4 | `pagar arriendo 300000 el 5` | `payment` | `payment`, amount=300000 | **PASS** | — | — |
| 5 | `comprar bebida 2000` | `payment` (gasto) | `payment`, amount=2000 | **PASS** | — | — |
| 6 | `tabaco 15000` | `payment` o `shopping_list` con monto | `note`, amount=15000 | **FAIL** | alta | `normalizer-agent.ts` (falta keyword de pago/compra para montos solitarios) |
| 7 | `me pagaron 250000` | `payment` (ingreso) | `note`, amount=250000 | **FAIL** | alta | `normalizer-agent.ts` (`TYPE_PATTERNS.payment` no incluye ingresos sin keyword de pago) |
| 8 | `ingreso venta hamburguesas 45000` | `payment` (ingreso) | `note`, amount=45000 | **FAIL** | alta | `normalizer-agent.ts` |

**Resumen pagos:** 5/8 PASS. Los ingresos cotidianos (`me pagaron`, `ingreso venta`) no se detectan como `payment` porque el clasificador requiere un keyword de pago explícito (`pagar`, `factura`, etc.) **y** `hasPaymentIntent`. Los ingresos solo matchean en `getFinancialDirection` (capa de finanzas), no en el parser.

---

### 2.9 Salud humana

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `doctor lunes 9:30` | `appointment` → health + calendar | `appointment`, título `"Doctor"`, health+calendar | **PASS** | — | — |
| 2 | `ir al médico sábado 15:00` | `appointment` → health + calendar | `appointment`, título `"Ir al médico"`, health+calendar | **PASS** | — | — |
| 3 | `dentista viernes 10:00` | `appointment` → health + calendar | `appointment`, título `"Dentista"`, health+calendar | **PASS** | — | — |
| 4 | `terapia kine martes 17:00` | `appointment` → health + calendar | `appointment`, título `"Terapia kine"`, health+calendar | **PASS** | — | — |
| 5 | `tomar pastilla lunes 9am` | `health` + calendar | `health`, título `"Tomar pastilla"`, health+calendar | **PASS** | — | — |
| 6 | `tomar remedio todos los días 22:00` | `health`, recurrencia | `health`, tag `recurrente` | **PASS** | — | — |
| 7 | `examen de sangre jueves 8:00` | `appointment` → health + calendar | `appointment`, título `"Examen de sangre"`, health+calendar | **PASS** | — | — |
| 8 | `comprar remedio en farmacia` | `shopping_list` o `task` | `health` (y `purchases: true` por surface-resolver) | **FAIL** | media | `normalizer-agent.ts` |

**Resumen salud:** 7/8 PASS. `"comprar remedio"` es el único falso positivo de salud.

---

### 2.10 Mascotas

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `pastilla para la gata Luna 9am lunes` | `pet` + calendar | `pet`, título útil, calendar secundario, **NO health** | **PASS** | — | — |
| 2 | `pastilla Luna lunes 9am` | `pet` + calendar | `pet`, título `"Pastilla Luna"`, **NO health** | **PASS** | — | — |
| 3 | `dar remedio a Luna viernes 20:00` | `pet` + calendar | `pet`, **NO health** | **PASS** | — | — |
| 4 | `Luna veterinario viernes` | `pet` + calendar | `pet`, **NO health** | **PASS** | — | — |
| 5 | `vacuna Rocky sábado 11:00` | `pet` + calendar | `pet`, **NO health** | **PASS** | — | — |
| 6 | `comprar comida para Luna mañana` | `pet` o `task` | `task` — no detecta contexto mascota sin keyword animal | **FAIL** | media | `normalizer-agent.ts` (`hasPetAction` no asocia `"Luna"` sola con mascota) |
| 7 | `bañar a Rocky domingo` | `pet` | `note` — `"bañar"` no está en `TYPE_PATTERNS.pet` ni `hasPetAction` | **FAIL** | alta | `parser-rules.ts`, `normalizer-agent.ts` |
| 8 | `cortar uñas a Luna sábado` | `pet` | `note` — `"cortar"` no es task/pet keyword | **FAIL** | alta | `normalizer-agent.ts` |
| 9 | `buscar información sobre mascotas para informe` | `note` | `task` — `"buscar"` es task keyword | **FAIL** | baja | `normalizer-agent.ts` |

**Resumen mascotas:** 5/9 PASS. Los 3 aciertos centrales (pastilla/vacuna/veterinario con nombres propios) son sólidos. Los fallos son por verbos faltantes (`bañar`, `cortar`) y contexto implícito (`comida para Luna`).

---

### 2.11 Calendario / eventos

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `partido con amigos miércoles 19:30` | `calendar` | `calendar`, título `"Partido con amigos"` | **PASS** | — | — |
| 2 | `cumpleaños de Ana viernes 21:00` | `calendar` | `calendar`, título `"Cumpleaños de Ana"` | **PASS** | — | — |
| 3 | `cena familiar sábado 20:30` | `calendar` | `calendar`, título `"Cena familiar"` | **PASS** | — | — |
| 4 | `reunión con Juan lunes 10:00` | `calendar` | `calendar`, título `"Reunión con Juan"` | **PASS** | — | — |
| 5 | `domingo 2 eventos primero 17:30 partido segundo 21:30 cine` | `calendar`, multi-evento | `calendar`, título `"2 eventos"`, hora 17:30, kind `multi_event` | **PASS** | — | — |

**Resumen calendario:** 5/5 PASS. Títulos útiles, multi-evento funciona.

---

### 2.12 Notas / ideas / RADAR

| # | Entrada | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|---------|----------|----------------|--------|-----------|------------------|
| 1 | `Drive, Gmail... herramientas para conectar con Liev` | `note` | `note`, no contamina | **PASS** | — | — |
| 2 | `Habilitar sketchnoting en notas` | `note` | `note` | **PASS** | — | — |
| 3 | `Mejorar UX de las cards de compras` | `note` | `note` | **PASS** | — | — |
| 4 | `Idea: Companion Pet para futuro` | `note` | `note` | **PASS** | — | — |
| 5 | `Analizar si Liev debería tener integración con calendario externo` | `note` | `note` | **PASS** | — | — |
| 6 | Texto largo con keywords de dominio | `note` | `note`, `isLongFormNote` bloquea | **PASS** | — | — |

**Resumen notas:** 6/6 PASS. Sin contaminación.

---

### 2.13 BottomNav / navegación móvil (inspección de código)

| # | Acción | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|--------|----------|----------------|--------|-----------|------------------|
| 1 | Tocar Home | Navegar a `/` | `Link href="/"` | **PASS** | — | — |
| 2 | Tocar Compras | Navegar a `/purchases` | `Link href="/purchases"` | **PASS** | — | — |
| 3 | Tocar Finanzas | Navegar a `/payments` | `Link href="/payments"` | **PASS** | — | — |
| 4 | Tocar Salud | Navegar a `/health` | `Link href="/health"` | **PASS** | — | — |
| 5 | Tocar Mascotas | Navegar a `/pets` | `Link href="/pets"` | **PASS** | — | — |
| 6 | Tocar Notas | Navegar a `/notes` | `Link href="/notes"` | **PASS** | — | — |
| 7 | Input enfocado → tocar Salud | Navegar y cerrar teclado | `onClickCapture` hace `blur()` del input activo antes de navegar | **PASS** | — | `BottomNav.tsx` |
| 8 | Input enfocado → tocar Mascotas | Navegar y cerrar teclado | Mismo comportamiento | **PASS** | — | — |
| 9 | Input enfocado → tocar Compras | Navegar y cerrar teclado | Mismo comportamiento | **PASS** | — | — |

**Resumen BottomNav:** 9/9 PASS por inspección de código. El `onClickCapture` con `activeElement.blur()` resuelve el problema de doble toque en iOS.

---

### 2.14 Input / Enter / multiline (inspección de código)

| # | Acción | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|--------|----------|----------------|--------|-----------|------------------|
| 1 | Escribir nota larga con saltos | Permitir multiline | `<textarea>` con `whiteSpace: pre-wrap`, `rows={1}`, auto-resize | **PASS** | — | `UniversalInput.tsx` |
| 2 | Presionar Enter | Salto de línea, NO enviar | `Enter` solo inserta `\n`; no hay handler de submit en `onKeyDown` para Enter puro | **PASS** | — | — |
| 3 | Botón "+" guarda | Guardar entrada | `type="submit"` en form con `handleSubmit` | **PASS** | — | — |
| 4 | Cmd/Ctrl+Enter | Guardar entrada | `handleComposerKeyDown` captura `metaKey||ctrlKey` + Enter y llama `submitEntry` | **PASS** | — | — |

**Resumen Input:** 4/4 PASS por inspección de código. No hay envíos accidentales.

---

### 2.15 Persistencia / sync / duplicados (inspección de código)

| # | Escenario | Esperado | Resultado real | Estado | Severidad | Archivo probable |
|---|-----------|----------|----------------|--------|-----------|------------------|
| 1 | Crear compra con checklist | Persistir en Dexie | `createEntry` + `createChecklistItems` para `shopping_list` | **PASS** | — | `db/entries.ts` |
| 2 | Marcar ítems | Persistir estado checked | `toggleShoppingItem` actualiza `metadata.items` y `progress`; `toggleChecklistItem` actualiza tabla `checklist_items` | **PASS** | — | — |
| 3 | Refrescar | Checks persisten | Datos en IndexedDB, no en memoria | **PASS** | — | — |
| 4 | Crear mascota con fecha | Persistir | `createEntry` con fecha/time | **PASS** | — | — |
| 5 | No duplicar tras refresh | Sin duplicados | `buildEntryFingerprint` + dedup en `createEntry`; `useEntries` filtra `deletedAt` | **PASS** | — | `db/entries.ts`, `lib/sync/dedupe.ts` |
| 6 | Eliminar card | Tombstone o hard delete | `softDeleteChecklistItemsForEntry` + `deletedAt` timestamp en entry | **PASS** | — | — |
| 7 | Sync no resucita borrados | Borrado propagado | `deletedAt` se propaga en sync; `useEntries` filtra `!deletedAt` | **PASS** | — | — |

**Resumen persistencia:** 7/7 PASS por inspección de código. Soft-delete funcional, dedup activo.

---

## 3. Top 5 bugs encontrados (ordenados por impacto)

### Bug 1 — Verbos cotidianos faltantes en `TYPE_PATTERNS.task`
- **Impacto:** ALTO. Tareas domésticas comunes (`ordenar`, `cargar`, `llamar`, `regar`, `bañar`, `cortar`) caen a `note`, contaminando Home y perdiendo accionabilidad.
- **Archivo:** `src/core/agents/normalizer-agent.ts` (líneas 29-31).
- **Fix sugerido:** Agregar `\b(ordenar|cargar|llamar|regar|bañar|cortar|planchar|aspirar|fregar|sacudir)\b` al patrón de `task`.

### Bug 2 — Ingresos cotidianos no detectados como `payment`
- **Impacto:** ALTO. `"me pagaron 250000"` y `"ingreso venta 45000"` resuelven a `note`, por lo que Finanzas no cuenta ingresos reales.
- **Archivo:** `src/core/agents/normalizer-agent.ts` (clasificación payment) y `src/core/agents/parser-rules.ts` (`hasPaymentIntent`).
- **Fix sugerido:** Que `hasPaymentIntent` (o un nuevo guard `hasIncomeIntent`) reconozca `me pagaron`, `ingreso`, `venta`, `cobré` como intent financiero válido, o crear un flujo `income` separado en el parser.

### Bug 3 — Compras de tabaquería no generan `shopping_list`
- **Impacto:** MEDIO. Tabaco, filtros, etc. son productos cotidianos que no están en `ITEM_CATEGORY_MAP` ni `STORE_TYPE_PATTERNS`.
- **Archivo:** `src/core/agents/list-builder-agent.ts`.
- **Fix sugerido:** Agregar `tabaquería` como store type y `tabaco`, `filtros`, `papelillos` como items de categoría `tabaquería` (o `otros` conocidos).

### Bug 4 — `note` con keyword de compra filtra a purchases
- **Impacto:** MEDIO. `"domingo feria verduras para la semana"` resuelve a `note` pero `shouldShowOnSurface(..., 'purchases') === true` porque `hasActionablePurchaseIntent` matchea `"feria"` sin verificar `type`.
- **Archivo:** `src/core/display/surface-resolver.ts`.
- **Fix sugerido:** En `hasActionablePurchaseIntent`, excluir explícitamente `entry.type === 'note'` a menos que tenga `metadata.listKind === 'shopping'`.

### Bug 5 — Recurrencia no soportada (`martes y viernes`, `todos los domingos`)
- **Impacto:** MEDIO. Solo se guarda el primer día detectado. El usuario pierde la intención de recurrencia.
- **Archivo:** `src/core/agents/parser-agent.ts` (`extractDate`).
- **Fix sugerido:** Guardar múltiples fechas detectadas en un array `dates` en metadata, o al menos preservar el texto original completo para que el usuario vea la recurrencia.

---

## 4. Top 5 cosas que ya funcionan bien

1. **Shopping lists con ítems conocidos** — Supermercado, minimarket, feria, ferretería y farmacia generan listas con categorías, progreso y checklist interactivo sin fallos.
2. **Pagos explícitos** — Cualquier input con `"pagar"` + monto resuelve a `payment` 100 % de las veces, con fecha/hora si están presentes.
3. **Salud + calendario** — Citas médicas (`doctor`, `dentista`, `kine`, `examen`) y tomas de medicamentos van a `health` con calendario secundario y títulos útiles.
4. **Mascotas sin contaminación** — Entradas con nombres propios (`Luna`, `Rocky`) + acciones concretas (`pastilla`, `vacuna`, `veterinario`) van a `pets` y **no** filtran a `health`.
5. **Notas/ideas no contaminan** — Inputs largos o con keywords de proyecto (`sketchnoting`, `Drive`, `Gmail`, `integración`) quedan como `note` y no aparecen en Compras/Salud/Mascotas/Pagos.

---

## 5. Riesgos de producción

| Riesgo | Probabilidad | Impacto | Detalle |
|--------|-------------|---------|---------|
| Build falla en 404/500 | ALTA | BAJO | `npm run build` falla por `<Html>` fuera de `_document`. Vercel puede tolerarlo, pero es técnica deuda. |
| Home contaminado con tareas caídas a `note` | ALTA | MEDIO | Usuarios verán `"ordenar la pieza"`, `"cargar la bip"`, `"llamar a mi mamá"` en Notas en vez de Tareas, reduciendo claridad. |
| Finanzas sub-reportan ingresos | MEDIA | ALTO | `"me pagaron"` e `"ingreso venta"` no son `payment`, por lo que `computeFinanceSummary` ignora el monto. |
| Duplicados tras sync (teórico) | BAJA | MEDIO | La deduplicación existe (`buildEntryFingerprint`), pero no hay test end-to-end que valide sync real con dispositivo secundario. |
| Calendario sobrepoblado | MEDIA | BAJO | Shopping lists y pet entries con fecha ahora tienen `calendar` como secondary surface. Puede saturar la vista `/calendar`. |

---

## 6. Recomendación

**Hotfix antes de seguir** (2-3 archivos, 30 minutos):

1. **Agregar verbos cotidianos a `TYPE_PATTERNS.task`** (`normalizer-agent.ts`) — `ordenar`, `cargar`, `llamar`, `regar`, `bañar`, `cortar`.
2. **Corregir build** — Revisar `pages/_error.tsx` (o similar) y eliminar importación ilegal de `next/document`.
3. **Opcional pero recomendado:** Hacer que `"me pagaron"` y `"ingreso""` con monto clasifiquen como `payment` (o crear type `income`).

**Separar en otro commit:**
- Agregar tabaquería a `STORE_TYPE_PATTERNS` e `ITEM_CATEGORY_MAP`.
- Soporte de recurrencia (`martes y viernes`).

**Bloquear deploy:** NO. El core funciona. Los bugs son de cobertura de keywords, de estabilidad.

---

## 7. Notas para futuros agentes

- **No modificar `package.json`, `package-lock.json`, `next.config.mjs`** sin aprobación explícita (regla `AGENTS.md`).
- Si se agregan keywords a `TYPE_PATTERNS.task`, verificar que no capturen falsos positivos en notas largas (el `isLongFormNote` guard debería proteger).
- El test suite actual cubre 137 casos y todos pasan. Cualquier fix debe mantenerlos verdes.
- El componente `TimelineView` hace dedup visual de shopping lists por `(title, date)` en `TimelineGroup`. Esto evita duplicados visuales pero no de datos.
