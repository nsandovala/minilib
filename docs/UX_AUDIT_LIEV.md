# LIEV — UX / FLOW ARCHITECTURE AUDIT

## 1. Estado actual UX

### Fortalezas

- **Identidad visual coherente.** La paleta oscura minimalista, el uso de `glass-card`, la tipografía Geist y el sistema de acentos (`#c9a882`, `#7a9e7e`) funcionan bien juntos. La atmósfera calmada está presente.
- **UniversalInput bien resuelto.** El sistema de tokenización en capas (highlight + textarea real) y los chips de preview (tipo, monto, fecha) transmiten claridad sin explicar IA. Es un buen ejemplo de "inteligencia invisible".
- **Landing page premium.** La landing tiene ritmo visual, jerarquía clara y CTA simple. El orbit animation es sutil y no invade.
- **BottomNav estable.** 6 íconos, estilo pill con blur, active state con color y fondo. Es predecible y accesible.
- **Lógica de display sólida.** `surface-resolver.ts` y `display-rules.ts` muestran un esfuerzo real por mantener la semántica estable sin mutar datos. El `longFormGuard` y los `correctionHint` son arquitectura pensada.
- **Timeline grouping cognitivo.** El agrupamiento en `Ahora / Hoy / Próximos días / Sin fecha / Completado` sigue un modelo mental natural.
- **NextBestAction como guía.** La sección "Ahora" en Home es un buen intento de reducir fricción de decisión, aunque su densidad puede mejorarse.

### Debilidades

- **No existe Reader Mode.** El flujo es `tap → edit` tanto en `NoteCard` (notas) como en `TimelineItem` (timeline). No hay estado de lectura dedicado. Esto rompe la promesa de "libreta tranquila": el usuario no puede simplemente revisar sin entrar en modo edición.
- **Edit Mode genérico.** `NoteEditor` es un overlay con `<input>` + `<textarea>`. No hay toolbar, no hay formatting, no hay checklist insertion, no hay sensación de "espacio de pensamiento". El auto-focus en el título dispara el keyboard inmediatamente en mobile.
- **Dos sistemas de cards conviviendo.** `NoteCard` (usado en `/notes`) y `TimelineItem` (usado en `TimelineView`) tienen estructuras, padding, tipografía y comportamiento de interacción diferentes. Rompen consistencia cognitiva.
- **Cards expanden inline.** El `TimelineItem` usa `grid-template-rows` para expandir dentro del feed. Esto genera cards que crecen sin límite, destruyendo el ritmo visual y haciendo que el scroll se sienta pesado e impredecible.
- **Densidad de metadata excesiva.** En collapsed state, una `TimelineItem` puede mostrar: pill de tipo, título, dot de prioridad, microcopy, fecha, monto, status badge, progress label, checklist preview (3 items). Es demasiado para escanear rápido.
- **Explicaciones que añaden ruido.** Las `DetailLine` con label `Liev` y los `correctionHint` visibles en expanded state generan la sensación de que la app "se justifica" constantemente. Rompe la calma.
- **Inconsistencia entre páginas.** `/payments` tiene su propio `EntryCard` (otro componente más). `/health` y `/pets` usan `FilteredEntriesPage` con `TimelineView`. `/notes` usa `NoteCard` + `NoteEditor`. No hay un sistema card único.
- **Chips + MiniCalendar + Summary + NextBestAction + Input.** La Home tiene muchos elementos previos al feed. Cada uno añade valor, pero en conjunto crean una "cabeza pesada" antes de llegar al contenido principal.

---

## 2. Problemas críticos

### P1 — No hay separación entre LEER y EDITAR (CRÍTICO)
**Impacto:** Alto. **Esfuerzo:** Medio.

El flujo natural de una libreta es: veo → leo → (opcionalmente) edito. Actualmente el usuario es forzado al modo edición con solo tocar. Esto genera:
- Keyboard apareciendo sin consentimiento.
- Fricción para el 90% de interacciones que son solo revisión.
- Sensación de CRUD genérico en lugar de espacio tranquilo.

**Evidencia:** `NoteCard` (`onEdit` directo), `TimelineItem` (inline edit al tocar el icono de lápiz, pero el cuerpo principal solo expande; no hay "leer" dedicado).

### P2 — Cards largas destruyen el ritmo visual (CRÍTICO)
**Impacto:** Alto. **Esfuerzo:** Medio.

El `TimelineItem` expande inline (`grid-template-rows: 0fr ↔ 1fr`). Una lista de compras con 15 ítems, un calendario con eventos, o un pago con 5 DetailLines convierten una card de ~80px en una de 500px+. El feed deja de ser escaneable.

**Evidencia:** `TimelineItem` líneas 943-1074. El expanded state renderiza todo el contenido sin límite de altura.

### P3 — Edit Mode es un textarea genérico (CRÍTICO)
**Impacto:** Alto. **Esfuerzo:** Medio-Alto.

`NoteEditor` es un overlay con `position: fixed`, un input para título y un textarea para cuerpo. No hay:
- Toolbar contextual (checklist, formato mínimo).
- Fullscreen limpio (el topbar ocupa espacio y dice "Editar nota").
- Mejor spacing o tipografía de editor.
- Sensación de inmersión.

**Evidencia:** `NoteEditor.tsx` (111 líneas). `titleRef.current?.focus()` en `useEffect` dispara keyboard inmediatamente.

### P4 — Dos sistemas de cards sin unificación (ALTO)
**Impacto:** Alto. **Esfuerzo:** Medio.

- `NoteCard`: padding `18px 20px`, título con `white-space: nowrap`, footer con botones edit/delete visibles, sin checkbox.
- `TimelineItem`: padding `13px 14px`, checkbox a la izquierda, pill de tipo + título + dot, sin footer, expande inline.
- `EntryCard` (payments): padding `12px 14px`, círculo de done, monto a la derecha, expande inline.

El usuario no sabe qué esperar al tocar una card dependiendo de la pantalla.

### P5 — Densidad de metadata en collapsed state (ALTO)
**Impacto:** Medio. **Esfuerzo:** Bajo.

Una card collapsed muestra demasiadas capas:
1. Checkbox + Type pill + Title + Priority dot
2. Microcopy (solo en "Ahora")
3. Categoría de compra
4. Preview de checklist (hasta 3 items + "+N más")
5. Meta row: fecha + monto + status badge + progress label + prioridad

Esto es 5-6 capas de información para una card que debería ser una "ficha resumida".

### P6 — "Liev" label y calmExplanation como ruido (MEDIO)
**Impacto:** Medio. **Esfuerzo:** Bajo.

Las `DetailLine label="Liev"` y los `correctionHint` generan la sensación de que la app se explica a sí misma constantemente. En una libreta tranquila, el usuario no necesita saber "por qué" la app clasificó algo. Solo necesita que funcione.

**Evidencia:** `TimelineItem` líneas 1016-1028, `display-rules.ts` `shouldShowCalmExplanation`.

### P7 — BottomNav con 6 items puede ser excesivo para mobile (MEDIO)
**Impacto:** Medio. **Esfuerzo:** Bajo.

En pantallas < 375px, 6 ítems en la nav pill generan touch targets muy juntos. Apple Human Interface Guidelines recomienda 5 como máximo en tab bars. Considerar si alguna categoría puede agruparse o moverse.

---

## 3. Fixes rápidos (quick wins)

### Q1 — Eliminar auto-focus en NoteEditor en mobile
**Archivo:** `NoteEditor.tsx`
**Cambio:** No hacer `focus()` en `useEffect` si `window.innerWidth < 768`. Dejar que el usuario toque el campo que quiere editar.
**Impacto:** Elimina el keyboard shock.

### Q2 — Reducir altura máxima de preview en NoteCard
**Archivo:** `NoteCard.tsx`
**Cambio:** `WebkitLineClamp: 2` es correcto, pero añadir `max-height` en la card y un `fade-bottom` visual para indicar que hay más contenido.
**Impacto:** Cards más compactas, mejor ritmo.

### Q3 — Ocultar botones edit/delete de NoteCard en estado collapsed
**Archivo:** `NoteCard.tsx`
**Cambio:** Reemplazar los botones siempre-visibles por un menú de 3 puntos (o swipe-to-actions) o moverlos al Reader Mode.
**Impacto:** Reduce ruido visual en la lista.

### Q4 — Limitar items preview en TimelineItem collapsed
**Archivo:** `TimelineView.tsx`
**Cambio:** `collapsedItems` ya limita a 3, pero los 3 items + "+N más" + meta row siguen siendo mucho. Considerar mostrar solo 1-2 items y condensar el meta row.
**Impacto:** Cards más escaneables.

### Q5 — Reducir frecuencia de calmExplanation
**Archivo:** `display-rules.ts`
**Cambio:** Aumentar el umbral de `confidence` para mostrar `calmExplanation`. Ocultar por defecto en collapsed state completamente. Solo mostrar en expanded si el usuario explicitamente pidió "explicar".
**Impacto:** Menos ruido explicativo.

### Q6 — Unificar padding y border-radius de cards
**Archivo:** `globals.css` + `TimelineView.tsx` + `NoteCard.tsx`
**Cambio:** Definir una escala estricta: `padding: 14px 16px` para cards compactas, `border-radius: 16px` consistente.
**Impacto:** Coherencia visual inmediata.

---

## 4. Fixes estructurales

### S1 — Arquitectura Reader Mode
**Objetivo:** `HOME → Reader Mode → Edit Mode`

**Propuesta:**
- **Collapsed card:** Muestra solo lo esencial (tipo, título, 1-2 metadatos clave, fade bottom si es larga).
- **Tap en card:** Abre **Reader Mode** — un modal/drawer/bottom-sheet que muestra el contenido completo en formato legible, sin keyboard.
- **Reader Mode toolbar:** Un botón discreto "Editar" (o un gesto/ícono) que transiciona a Edit Mode.
- **Edit Mode:** Reemplaza el reader con el editor. El keyboard aparece aquí, no antes.

**Implementación sugerida:**
- Crear `ReaderDrawer` o `ReaderModal` component.
- En `TimelineItem`, cambiar `onClick` del header: en lugar de `setExpanded`, abrir `ReaderDrawer` con la entry.
- En `NoteCard`, cambiar `onClick` para abrir `ReaderDrawer` en lugar de `NoteEditor` directo.
- El `ReaderDrawer` tiene un botón "Editar" que abre `NoteEditor` (o `EntryEditor` unificado).

### S2 — Rediseñar Edit Mode como "espacio de pensamiento"
**Objetivo:** Dejar de sentirse como un formulario.

**Propuesta:**
- Fullscreen con fondo limpio (sin `overlay` con `backdrop-filter` excesivo).
- Toolbar minimalista flotante (sólo si es relevante: checklist toggle, formato simple).
- Título integrado en el flujo, no como campo separado rígido.
- Opcional: placeholder sutil que desaparece, no un `<input>` con border-bottom.
- Espaciado generoso (`line-height: 1.8` para cuerpo).
- Guardado automático (debounced) en lugar de botón "Guardar" prominente.

### S3 — Compactar TimelineItem con preview limitada y expand-to-reader
**Objetivo:** Eliminar la expansión inline.

**Propuesta:**
- **Collapsed:** Mostrar solo: checkbox, título (1 línea), fecha/monto (1 línea), y un indicador de tipo sutil (no un pill completo). Altura fija ~64px.
- **Si hay checklist:** Solo mostrar `checked/total` como texto micro, no los items individuales.
- **Si hay nota larga:** `line-clamp: 2` con `fade-bottom`.
- **Tap:** Abre Reader Mode (no expande inline).
- **Swipe (opcional futuro):** Marcar done, pin, o acciones secundarias.

### S4 — Unificar sistema de cards (un solo componente con variantes)
**Objetivo:** Eliminar `NoteCard`, `TimelineItem`, `EntryCard` separados.

**Propuesta:**
- Crear `EntryCard` único en `src/components/cards/EntryCard.tsx`.
- Variantes controladas por prop `variant`: `'compact' | 'preview' | 'reader'`.
- `compact`: usada en timeline, altura controlada, metadata mínima.
- `preview`: usada en listas de resumen (como `NextBestAction` o calendario).
- `reader`: usada en `ReaderDrawer`, muestra todo el contenido.
- La lógica de renderizado por tipo (shopping, payment, calendar, note) se maneja con sub-componentes o render props dentro del `EntryCard` unificado.

### S5 — Revisar jerarquía de información (qué mostrar en collapsed vs expanded/reader)
**Objetivo:** La card collapsed debe responder "¿qué es y cuándo?" en un vistazo.

**Regla propuesta:**
| Información | Collapsed | Reader | Edit |
|-------------|-----------|--------|------|
| Título | ✅ | ✅ | ✅ editable |
| Tipo | ✅ (símbolo o micro-texto) | ✅ pill | ✅ |
| Fecha | ✅ si existe | ✅ | ✅ editable |
| Monto | ✅ si existe | ✅ | ✅ editable |
| Status | ✅ solo si urgente | ✅ | ✅ |
| Checklist items | ✅ solo count | ✅ full | ✅ editable |
| Texto largo | ✅ clamp 2 líneas | ✅ full | ✅ editable |
| CalmExplanation | ❌ | ❌ (oculto por defecto) | ❌ |
| CorrectionHint | ❌ | ❌ (menú de acciones) | ❌ |
| Microcopy | ❌ | ✅ si útil | ❌ |
| Original text | ❌ | ✅ si difiere del título | ✅ |

### S6 — Revisar BottomNav
**Objetivo:** Reducir a 5 o menos ítems principales.

**Opciones:**
- **Opción A:** Agrupar `Health + Pets` en `Cuidados` (o `Vida`), y `Purchases + Payments` en `Gastos`.
- **Opción B:** Mover `Notes` a un FAB o acceso secundario (Home ya es la libreta universal).
- **Opción C:** Mantener 6 pero con swipe-gesture o scroll horizontal en la nav (no recomendado, más complejo).
- **Recomendación:** Evaluar analytics de uso. Si `Notes` es poco usado desde la nav, convertirlo en acceso desde Home.

---

## 5. Roadmap UX por fases

### Fase 1 — Fixes críticos (semana 1-2)
- Q1: Eliminar auto-focus en `NoteEditor` en mobile.
- Q2: Añadir `max-height` + `fade-bottom` en `NoteCard` y `TimelineItem`.
- Q3: Ocultar botones edit/delete permanentes en `NoteCard` (mover a menú/reader).
- Q4: Limitar meta row en `TimelineItem`: quitar microcopy de collapsed, quitar checklist preview de 3 items, dejar solo count.
- Q5: Reducir `shouldShowCalmExplanation` a casos extremos (confidence < 0.5 o autoCorrected explícito).
- Q6: Unificar padding `14px 16px` y border-radius `16px` en todas las cards.

### Fase 2 — Reader architecture (semana 3-4)
- Crear `ReaderDrawer` component (bottom sheet o modal, no overlay con blur excesivo).
- Implementar flujo `Tap → ReaderDrawer` para `TimelineItem` y `NoteCard`.
- En `ReaderDrawer`: mostrar contenido completo, metadata completa, checklist interactiva, calendar events.
- En `ReaderDrawer`: botón "Editar" que abre `NoteEditor` (o nuevo `EntryEditor`).
- En `ReaderDrawer`: botones de acción (pin, delete, reclasificar) en toolbar inferior discreta.
- Eliminar expansión inline de `TimelineItem` (quitar `grid-template-rows` y `expanded` state).
- Reducir `TimelineItem` collapsed a la altura fija compacta (~64-72px).

### Fase 3 — Edit mode premium (semana 5-6)
- Rediseñar `NoteEditor` → `EntryEditor`.
- Fullscreen limpio, sin topbar pesado. Usar gesto de swipe-down para cancelar (como Apple Notes).
- Toolbar contextual flotante: checklist toggle, bold/italic (opcional).
- Guardado automático (debounce 1s) con indicador sutil "Guardado".
- Mejorar tipografía en edición: `font-size: 16px` para prevenir zoom iOS, `line-height: 1.8`.
- Hacer que el título sea editable inline (no `<input>` separado con border), estilo Notion/Bear.

### Fase 4 — Semantic stabilization (semana 7-8)
- Añadir UI de reclasificación manual en `ReaderDrawer` (menú "Cambiar a: tarea, pago, nota...").
- Mostrar confianza de clasificación solo cuando sea baja, de forma sutil (ej: dot amarillo en la card, no texto explicativo).
- Revisar parser rules para casos reportados (listas como notas, tareas como checklist, fechas malas).
- Implementar `reclassifyEntry` en `db/entries` si no existe.
- Añadir "feedback loop" silencioso: si el usuario corrige manualmente 3 veces, usar eso para ajustar pesos locales (no exponer al usuario).

### Fase 5 — Future calm integrations (post-semana 8)
- Evaluar si `NextBestAction` puede convertirse en un "daily digest" matutino en lugar de siempre visible.
- Considerar "Focus Mode": Home sin chips, sin summary, solo input + timeline.
- Evaluar "Archive" o "Descansar" (snooze) como alternativa a done/eliminar.
- Considerar voz o audio-entry como input adicional (sin romper minimalismo).

---

## 6. Riesgos UX futuros

### R1 — Feature creep en las cards
El sistema actual de `TimelineItem` ya soporta 6+ tipos con lógica condicional. Es tentador seguir añadiendo más DetailLines, más badges, más metadata. **Riesgo:** cada nuevo tipo de entry (ej: `travel`, `work`, `gift`) añadirá más ramas al componente y destruirá la consistencia.

**Mitigación:** Mantener la regla del Fase 4 (tabla collapsed/reader/edit). Nada nuevo entra a collapsed sin eliminar algo viejo.

### R2 — Convertirse en dashboard
La página `/payments` ya tiene `MiniBars`, `SummaryRow`, progreso de ingreso/egreso. Es funcional pero se acerca a una "app de finanzas". **Riesgo:** si se añaden gráficos, categorías, exportación, Liev deja de ser libreta y se convierte en wallet.

**Mitigación:** Mantener los resúmenes como un solo `SummaryCard` por página. No añadir más visualizaciones de datos.

### R3 — Chatbot o asistente conversacional
La infraestructura de agentes (`parser-agent`, `normalizer-agent`, `safety-agent`) puede tentar a añadir un chat. **Riesgo:** rompe el promise de "libreta tranquila" y se convierte en "otra app con IA visible".

**Mitigación:** La IA debe permanecer en el input y en la clasificación. Nunca en un chat UI.

### R4 — BottomNav explosion
Si se añaden más categorías (ej: `work`, `travel`, `family`), la nav explotará. **Riesgo:** 7+ tabs.

**Mitigación:** Nunca más de 5 tabs primarias. Nuevas categorías deben resolverse como tags/filtros dentro de Home, no como tabs.

### R5 — Notas largas destruyen todo
Si el usuario empieza a usar Liev como diario o documentos largos, las cards se vuelven imposibles. **Riesgo:** sin reader mode, el feed se convierte en muro de texto.

**Mitigación:** Reader Mode (Fase 2) es la defensa principal. Las cards largas deben ser siempre compactas con fade-bottom.

---

## 7. Recomendaciones de arquitectura visual

### A1 — Sistema de Card Variants (un único componente)
Crear un solo `EntryCard` con variantes:
- `variant="feed"`: para timeline y listas. Altura controlada, metadata mínima, fade-bottom si aplica.
- `variant="reader"`: para ReaderDrawer. Muestra todo, sin clamp, interacción completa (checklist toggles, etc.).
- `variant="edit"`: para el modo edición. El contenido se convierte en campos editables.

### A2 — Tokens de espaciado estrictos
Definir en `globals.css`:
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
```
Usar solo estos valores. Nada de `marginTop: '14px'` arbitrario.

### A3 — Fade-bottom en previews
Para cualquier texto truncado (notas, descripciones), usar un gradiente sutil que simule desvanecimiento:
```css
.preview-fade::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 24px;
  background: linear-gradient(transparent, var(--bg-card));
}
```

### A4 — AnimatePresence para transiciones
Usar `framer-motion` (si ya está en el proyecto o aceptable) o CSS transitions para:
- `ReaderDrawer` subiendo desde abajo (`translateY(100%) → 0`).
- `EditMode` apareciendo como overlay slide-up.
- Cards exiting/entering en el feed (sutil, `opacity + translateY`).

### A5 — Typographic scale definido
```css
--text-xs: 11px;
--text-sm: 12px;
--text-base: 14px;
--text-md: 15px;
--text-lg: 18px;
--text-xl: 22px;
--text-2xl: 26px;
```
La card `feed` debe usar solo `text-xs` para metadata, `text-sm` para título, `text-base` para reader.

### A6 — Acciones secundarias: ocultas por defecto
Ninguna card debe mostrar botones de editar/eliminar permanentemente. Opciones:
- **Swipe** (nativo mobile, pero complejo en web).
- **Long-press** (context menu).
- **ReaderDrawer** toolbar (recomendado: es explícito y calmado).
- **Menú de 3 puntos** (si el drawer no es viable inmediatamente).

### A7 — Jerarquía de color por tipo sutil
En lugar de un pill con texto por cada tipo, usar:
- Un **border-left sutil** de 2px con el color del tipo (payment: gold, health: green, etc.).
- El **type label** solo en `text-xs` y `uppercase` en la metadata row, no como pill prominente.
- Esto reduce el "ruido de badges" y mantiene identificación clara.

### A8 — El principio del "single tap decision"
En el feed, el usuario debe tomar una decisión con un solo tap:
- Tap → Reader (leer).
- Checkbox → Done (marcar).
- Nada más. No hay expand, no hay edit directo, no hay delete accidental.

### A9 — Regla de oro para nuevos features
Antes de añadir cualquier elemento visual a una card, preguntar:
> ¿Sin esto, el usuario puede decidir si actuar o no?

Si la respuesta es sí, no añadirlo.

---

## Resumen ejecutivo

Liev tiene una **base visual sólida** y una **lógica de clasificación inteligente**. El problema principal no es estético, es **arquitectural**: la falta de separación entre leer/editar y la expansión inline de cards destruyen la sensación de calma que el producto promete.

Las 3 prioridades son:
1. **Fase 1 (ya):** Compactar las cards, reducir metadata visible, eliminar auto-focus.
2. **Fase 2 (próxima):** Construir Reader Mode y eliminar expansión inline.
3. **Fase 3 (después):** Rediseñar Edit Mode como espacio de pensamiento, no como formulario.

Si se siguen estas fases, Liev pasará de sentirse como "una app CRUD con estilo" a sentirse como "una libreta tranquila donde descargo y reviso sin fricción".
