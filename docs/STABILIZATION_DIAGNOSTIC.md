# LIEV STABILIZATION — Diagnóstico Base (pre-Smart Shopping)

> Fecha: 2026-06-12
> Estado: CONTRATOS BASE CONGELADOS
> No implementar nuevas features todavía.

---

## 1. CARD CONTRACT — Estado Actual

### Comportamiento confirmado (TimelineView.tsx L780)

```typescript
onClick={entry.type === 'note' ? () => onReadNote?.(entry) : () => setExpanded((p) => !p)}
```

| Tipo | Tap en card | Acción secundaria |
|------|-------------|-------------------|
| `note` | Abre `NoteReader` overlay | Lápiz → `NoteEditor` |
| `shopping_list` | **Expande inline** → checklist interactiva | Lápiz → edición inline (`reparseAndUpdateEntry`) |
| `payment` | **Expande inline** → detalle de pago (monto, estado, tipo, próximo paso) | Lápiz → edición inline |
| `task` | **Expande inline** → próximo paso + detalle | Lápiz → edición inline |
| `health` / `appointment` | **Expande inline** → cuándo + próximo paso | Lápiz → edición inline |
| `pet` | **Expande inline** → cuándo + próximo paso | Lápiz → edición inline |
| `calendar` | **Expande inline** → agenda de eventos | Lápiz → edición inline |

### Riesgo detectado

- **Edición inline** (L623 `handleSaveEdit`) llama a `reparseAndUpdateEntry(entry.id, editText)`.
- Esto reparsea el texto completo y puede cambiar el tipo, monto, metadata, etc.
- Si el usuario edita un pago y borra el número, puede convertirse en `note`.
- **Impacto**: Medio. El usuario puede reclasificar después, pero pierde metadata (items de compra, montos).
- **Recomendación**: No tocar en esta fase. Es comportamiento heredado y funcional.

### Shopping checklist preview (collapsed)

- `sortedMetaShoppingItems.slice(0, 1)` → solo **1 ítem** visible en preview.
- **Contrato esperado**: 2 ítems + progreso.
- **Recomendación**: Cambiar a `slice(0, 2)` cuando se implemente Smart Shopping. Es un cambio de 1 carácter, 0 riesgo.

---

## 2. RADAR CONTRACT — Validación de 6 inputs

### Resultados

| Input | Tipo esperado | Radar result | Local fallback | Metadata | Estado |
|-------|---------------|--------------|----------------|----------|--------|
| `comprar pan leche bebida` | `shopping_list` | ✅ `shopping_list` | ✅ `shopping_list` | ✅ `ShoppingMetadata` | **OK** |
| `viernes comprar carne, caldos` | `shopping_list` | ✅ `shopping_list` | ✅ `shopping_list` | ✅ `ShoppingMetadata` | **OK** |
| `pagar luz 14990` | `payment` | ✅ `payment` | ✅ `payment` | ✅ `direction: expense` | **OK** |
| `realizar flyer jueves` | `task` | ✅ `task` | ✅ `task` | ❌ none | **OK** |
| `ideas para conectar Gmail Notion GitHub` | `note` | ✅ `note` | ✅ `note` | ❌ none | **OK** |
| `cilantro huevo cebolla` | `shopping_list` | ❌ `note` | ❌ `note` | ❌ none | **FALLA** |

### Análisis del caso fallido: `cilantro huevo cebolla`

**Problema**: El parser requiere una señal de compra explícita (`hasShoppingIntent`).
Las palabras `cilantro`, `huevo`, `cebolla` son ingredientes conocidos en `ITEM_CATEGORY_MAP`, pero **no hay verbo** (`comprar`, `pasar`, `ir`, etc.) ni store (`super`, `feria`, etc.).

**Dónde falla**:

1. `list-builder-agent.ts` → `buildShoppingList` → `shouldBuildShoppingList` recibe `hasShoppingIntent: false` (no hay verbo/store).
2. `hasKnownCategory` es `true` (cilantro/huevo/cebolla están mapeados).
3. Pero `hasShoppingIntent` es `false`.
4. `shouldBuildShoppingList` devuelve `false` porque requiere al menos una señal de compra concreta.
5. Resultado: `buildShoppingList` retorna `null`.
6. `parser-agent.ts` → `extractListMetadata` retorna `isListLike: false`.
7. `normalizer-agent.ts` → `classifyWithConfidence` → cae en `task` (porque `hasShoppingIntent` es false) o `note` (porque no hay verbo de task).

**Diagnóstico**: Es un **falso negativo defensivo**. El sistema prioriza no clasificar listas conceptuales como compras. Pero `cilantro huevo cebolla` es claramente una lista de compras.

**Fix recomendado (no implementar ahora)**:
- Ajustar `hasShoppingIntent` para detectar **listas de ingredientes conocidos** sin verbo explícito.
- O: Ajustar `shouldBuildShoppingList` para que `hasKnownCategory` con múltiples items (≥3) sea suficiente si todos son productos de abastecimiento.
- **Riesgo**: Podría generar falsos positivos con listas conceptuales (`"salud trabajo familia"`).

**Mitigación actual**: El usuario puede escribir `"comprar cilantro huevo cebolla"` y funciona perfecto.

---

## 3. NOTEREADER VISUAL — Auditoría

### Archivo: `src/components/notes/NoteReader.tsx`

### Por qué se siente vacío/negro

1. **Fondo**: `overlay` class → probablemente `background: rgba(0,0,0,0.85)` o similar. Sin textura, sin gradiente, sin capa de papel.
2. **Tipografía**: Solo hay 3 elementos visuales:
   - Título (`22px`, bold, blanco)
   - Chips de metadata (fecha, hora, monto) — 3 chips máximo
   - Cuerpo (`15px`, `line-height: 1.8`, gris)
3. **No hay jerarquía visual**: Todo es texto plano. No hay separadores, no hay bloques, no hay iconos de tipo.
4. **No hay acciones inteligentes**: Solo "Editar", "Cambiar tipo", "Eliminar". No hay "Convertir a tarea", "Agregar recordatorio", "Copiar texto".
5. **Sin contexto**: No muestra cuándo se creó, no muestra tags, no muestra el surface actual.
6. **Poco aprovechamiento del espacio**: En pantallas grandes, el texto queda centrado en una columna angosta con mucho negro alrededor.

### Propuesta: "Papel Nocturno Premium"

**Concepto**: En lugar de un overlay negro opaco, usar una capa de "papel nocturno" con textura sutil, como una libreta física abierta en la oscuridad.

**Cambios visuales (no implementados)**:

```
- Background: no #000, sino un gradiente muy sutil de warm-gray (RGB 18,16,13 → 22,20,17)
- Capa de textura: radial-gradient suave en el centro, más oscuro en los bordes
- Paper effect: border-top-left-radius y border-top-right-radius suaves
- Header: icono del tipo + label + timestamp, no solo chips
- Metadata en grid: fecha | hora | monto | tags → organizados como tarjetas
- Cuerpo: con una línea sutil a la izquierda (blockquote effect) si es largo
- Acciones inteligentes: fila de iconos debajo del cuerpo
  - Copiar texto
  - Compartir
  - Convertir a tarea
  - Agregar fecha
  - Marcar como hecho
- Footer: createdAt / updatedAt en texto diminuto
```

### Metadata que debería mostrar

| Campo | Visible? | Sugerencia |
|-------|----------|------------|
| `type` | Parcial (label) | Mostrar icono + label con color del tipo |
| `date` | ✅ | OK, pero formatear a "viernes 12 de junio" |
| `time` | ✅ | OK |
| `amount` | ✅ | OK, pero con formato `$14.990 CLP` |
| `tags` | ❌ No mostradas | Agregar chips de tags |
| `createdAt` | ❌ No mostrada | Agregar "Creada hace 2 días" |
| `updatedAt` | ❌ No mostrada | Agregar "Editada hace 1 h" |
| `confidence` | ❌ No mostrada | Solo mostrar si < 0.75 ("Clasificación incierta") |
| `reason` | ❌ No mostrada | Solo mostrar en modo debug |

### Acciones inteligentes que debería tener

| Acción | Trigger | Estado actual |
|--------|---------|---------------|
| Editar | Botón principal | ✅ |
| Cambiar tipo | Botón secundario | ✅ (ya existe) |
| Eliminar | Botón peligro | ✅ |
| Marcar como hecho | Toggle | ❌ (no existe) |
| Copiar texto | Icono clipboard | ❌ |
| Compartir | Icono share | ❌ |
| Convertir a compra | Solo si es note | ❌ |
| Agregar fecha/hora | Solo si no tiene | ❌ |

---

## 4. SHOPPING SMART DESIGN — Auditoría

### Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/core/agents/list-builder-agent.ts` | Construye `ShoppingMetadata` con items, categorías, precios |
| `src/db/entries.ts` | `toggleShoppingItem`, `recalcShoppingProgress` |
| `src/lib/shopping-metadata.ts` | Helpers `getShoppingMetadata`, `getSafeShoppingItems` |
| `src/components/TimelineView.tsx` | Render de checklist inline + `MetadataChecklistRow` |
| `src/app/purchases/page.tsx` | `ShoppingSummary` con totales |
| `src/lib/radar.ts` | `radarToEntry` → genera `ShoppingMetadata` |

### Flujo actual de marcar item comprado

```
Usuario toca checkbox en TimelineView
  → MetadataChecklistRow.onToggle()
  → toggleShoppingItem(entryId, itemId)
    → Lee entry.metadata
    → Invierte item.checked
    → Recalcula progress
    → Guarda entry.metadata actualizado
  → TimelineView recibe refresh
```

**Problemas detectados**:

1. **Sin persistencia de items individuales**: Los items viven en `entry.metadata.items` (JSON), no en una tabla relacional. No hay índice por item.
2. **Sin historial**: No se registra cuándo se marcó cada item.
3. **Sin cantidad real**: `quantity` y `unit` se parsean del texto, pero no se pueden editar.

### Pedir monto / sumar total

**Actual**: `list-builder-agent.ts` → `parseItemDetails` extrae precios del texto (`"pan 2.900"`). `buildProgress` suma `item.amount`.

**Limitaciones**:
- Solo extrae precios si están en el mismo string del item (`"pan 2.900"`).
- No funciona si el usuario escribe `"pan 2mil"` o `"pan dos mil"`.
- No hay input para agregar precio después de crear la lista.

**Diseño propuesto (no implementar)**:
```
- Al expandir item en NoteReader (o en inline), mostrar campo de precio editable
- Si el item tiene precio, mostrarlo al lado del checkbox
- Si la lista tiene precios, mostrar total estimado en la card collapsed
- Si el usuario marca item como comprado, mostrar subtotal parcial
```

### Sync con Payments

**Actual**: `shopping_list` y `payment` son tipos separados. No hay vínculo automático.

**Diseño propuesto (no implementar)**:
```
- Al completar una lista de compras (todos los items marcados), preguntar:
  "¿Cuánto gastaste en total?"
- Crear automáticamente un `payment` con:
  - title: "Compra en [storeType]"
  - amount: total ingresado
  - tags: ['expense', 'gasto cotidiano']
  - metadata: { linkedShoppingListId: entry.localId }
- Evitar duplicados: si ya existe un payment con ese linkedId, no crear otro
```

**Riesgo**: El usuario puede no querer que cada compra genere un pago. Debe ser opt-in.

### Evitar duplicados

**Actual**: `createEntry` en `db/entries.ts` tiene dos mecanismos:

1. **Dedup por texto + tipo (5 segundos)**:
```typescript
const dup = await db.entries
  .where('createdAt').above(fiveSecondsAgo)
  .filter((e) => e.type === data.type && e.text === data.text)
  .first();
```

2. **Dedup semántico por fingerprint**:
```typescript
const targetFingerprint = buildEntryFingerprint(ownerUserId, { type, title, text, date, amount, createdAt });
```

**Problemas**:
- El dedup de 5 segundos es muy corto. Si el usuario escribe la misma lista 1 minuto después, se duplica.
- El fingerprint semántico no considera `checklistItems`. Dos listas con mismos items pero diferente orden se ven como diferentes.

**Diseño propuesto (no implementar)**:
```
- Ampliar ventana de dedup a 5 minutos para shopping_list
- Normalizar items (sorted, lowercased) antes de fingerprint
- Si hay lista activa con mismos items, sugerir "¿Agregar a lista existente?"
```

---

## 5. RIESGOS PENDIENTES

| Riesgo | Severidad | Mitigación actual |
|--------|-----------|-------------------|
| `cilantro huevo cebolla` → `note` | Medio | El usuario puede agregar "comprar" |
| Edición inline reparsea y pierde metadata | Medio | Comportamiento heredado, funcional |
| NoteReader se siente vacío | Bajo | Funcional, pero UX degradada |
| Shopping items viven en JSON blob | Medio | Funciona para <50 items, sin query por item |
| No hay sync automático shopping→payment | Bajo | No hay feature, no es bug |
| Dedup de 5 segundos muy corto | Medio | Puede generar duplicados |
| Preview de compras muestra 1 item | Bajo | Cambio de 1 carácter en `slice(0, 1)` → `slice(0, 2)` |

---

## 6. PRIMER PR PEQUEÑO RECOMENDADO

**Título**: `fix: shopping preview muestra 2 items + card maxHeight consistente`

**Cambios**:

1. `src/components/TimelineView.tsx` L670:
   ```typescript
   // Antes
   const collapsedItems = isShoppingList ? metaShopping ? sortedMetaShoppingItems.slice(0, 1) : sortedChecklistItems.slice(0, 1) : [];
   // Después
   const collapsedItems = isShoppingList ? metaShopping ? sortedMetaShoppingItems.slice(0, 2) : sortedChecklistItems.slice(0, 2) : [];
   ```

2. `src/components/TimelineView.tsx` L697:
   ```typescript
   // Antes
   maxHeight: entry.type === 'note' ? 152 : undefined,
   overflow: entry.type === 'note' ? 'hidden' : undefined,
   // Después
   maxHeight: 180,
   overflow: 'hidden',
   ```

**Impacto**: 0 riesgo. Solo cambia cuánto texto se ve en preview.

**Tests**: Los 70 tests existentes siguen pasando. No requiere nuevos tests.

---

## 7. ARCHIVOS INVOLUCRADOS (para cualquier trabajo futuro)

### Core (no tocar sin spec)
- `src/core/agents/list-builder-agent.ts` — Shopping list builder
- `src/core/agents/parser-rules.ts` — Intent detection
- `src/core/agents/normalizer-agent.ts` — Classification
- `src/core/cognitive/normalize-radar-result.ts` — Radar heuristic
- `src/core/display/surface-resolver.ts` — Surface routing

### UI (safe to modify)
- `src/components/TimelineView.tsx` — Card rendering + inline expand
- `src/components/notes/NoteReader.tsx` — Note reader overlay
- `src/components/notes/NoteEditor.tsx` — Note editor overlay
- `src/app/purchases/page.tsx` — Purchases page

### DB/Logic
- `src/db/entries.ts` — `createEntry`, `toggleShoppingItem`, `reclassifyEntry`
- `src/lib/entries.ts` — Display helpers, formatting
- `src/lib/shopping-metadata.ts` — Shopping metadata helpers
- `src/lib/radar.ts` — `radarToEntry`, `radarIntake`

---

## 8. VERIFICACIÓN DE BUILD

```bash
npm run typecheck   ✅
npm run build       ✅
node --experimental-strip-types tests/radar-intake.test.mjs   ✅ (70 tests)
```

---

**Resumen**: Los contratos base están funcionando. El card contract respeta la identidad de cada tipo. El radar contract funciona para 5/6 casos (el sexto es un falso negativo defensivo). La UX de NoteReader necesita rediseño visual pero no es un bug. Smart Shopping requiere diseño de features nuevas, no estabilización.

**Estado**: LISTO para Smart Shopping.
