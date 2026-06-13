# Liev — Fase 1 UX + Sync Fix (Resumen de sesión)

## Contexto
Branch: `feature/radar-zod-card-contracts`
Objetivo de la sesión: reducir densidad visual en cards, implementar Reader Mode mínimo para notas, corregir sync 500 por duplicate key, y pulir fondo modo claro.

---

## 1. Fase 1A — Respiración visual y reducción de densidad

### Archivos modificados
- `src/app/globals.css`
  - `--radius-lg: 18px → 16px` (unifica cards)
  - Nuevas clases: `.preview-fade`, `.note-action-btn`, `.note-action-btn-danger`
- `src/components/TimelineView.tsx`
  - Padding de cards: `13px 14px → 14px 16px`
  - Preview de checklist collapsed: `slice(0,3) → slice(0,1)`
  - Contador checklist: `>3 → >1`
  - Márgenes reducidos en microcopy, categoría y meta row
- `src/components/notes/NoteCard.tsx`
  - Padding: `18px 20px → 14px 16px`
  - Preview con `.preview-fade` y `maxHeight: 3.2em`
  - Botones edit/delete: `32px → 28px`, sin fondo/borde, opacidad baja (0.35)
- `src/components/notes/NoteEditor.tsx`
  - Auto-focus solo si `window.innerWidth >= 768` (elimina keyboard shock en mobile)
- `src/core/display/display-rules.ts`
  - Umbral `hasLowConfidence`: `< 0.8 → < 0.5` (reduce frecuencia de `calmExplanation`)

---

## 2. Fase 1B — Reader Mode mínimo + Sync Fix

### Reader Mode (solo notas)
- `src/components/notes/NoteReader.tsx` — NUEVO
  - Overlay fijo (`zIndex: 250`) para lectura sin teclado
  - Título 22px / cuerpo 15px con `lineHeight: 1.8`
  - Botones: Editar (primario) + Eliminar (icono discreto)
- `src/components/notes/NoteCard.tsx`
  - Nuevo prop `onRead`; tap en card abre reader
  - Botones edit/delete siguen disponibles con `stopPropagation`
- `src/app/notes/page.tsx`
  - Integra `NoteReader` en el flujo de estado (`showReader` / `readingNote`)
  - Flujo: `Tap → Reader → (opcional) Editar → NoteEditor`

### Sync 500 Fix
- `src/db/cloud/queries.ts`
  - `upsertEntries` ya no actualiza `dedupeKey` en `ON CONFLICT DO UPDATE`
  - Previene violación de `entries_user_dedupe_key_active_idx` al editar entries existentes
- `src/app/api/sync/push/route.ts`
  - Catch controlado para conflicto 23505 + constraint `entries_user_dedupe_key_active_idx`
  - Devuelve 207 (Multi-Status) con `ok: true` en lugar de 500

---

## 3. Light Theme Profile Background Polish

- `src/app/globals.css`
  - Textura SVG inline (3 formas orgánicas tipo hoja/pétalo) en `.home-profile-shell` modo claro
  - Opacidad extremadamente baja (0.02–0.035), sin afectar contraste de cards/input

---

## 4. Note Cards en Home/Profile (TimelineView)

- `src/components/TimelineView.tsx`
  - `entry.type === 'note'` renderiza variante visual limpia en collapsed:
    - Título 15px / 500 peso (estilo NoteCard)
    - Preview con `line-clamp: 2` + `.preview-fade`
    - Sin type pill, priority dot, microcopy, correctionHint
    - Meta row solo muestra fecha relativa
  - Expanded state de nota:
    - Solo texto completo con `whiteSpace: 'pre-wrap'`
    - Sin `DetailLine "Liev"`, `calmExplanation`, ni `correctionHint`
  - TODO(Fase 2): reemplazar expansión inline por `NoteReader` compartido

---

## Pendientes y riesgos para próxima sesión

1. **Reader Mode global**: la expansión inline de notas en Home/Profile debería eventualmente abrir `NoteReader` (igual que `/notes`). Requiere elevar estado de lectura a `Home` / `FilteredEntriesPage` o inyectar `NoteReader` en `TimelineView`.
2. **ESLint no instalado**: `eslint` no está en `devDependencies`. Se creó `.eslintrc.json` pero `npm run lint` no funciona sin instalar.
3. **Tests**: no existe framework de tests. El comando `npm test` no existe.
4. **BottomNav**: 6 ítems puede ser excesivo en mobile < 375px. Evaluar agrupación en Fase 5.
5. **Unificación de cards**: `TimelineItem`, `NoteCard` y `EntryCard` (payments) siguen como componentes separados. Fase 2/S4 del UX Audit propone `EntryCard` único con variantes.
6. **Note done circle**: el checkbox a la izquierda del timeline en notas no tiene mucho sentido semántico. Evaluar quitarlo solo para `type='note'`.

---

## Reglas de commit
- Mensajes en español, cortos y descriptivos
- No commitear archivos de contexto de otras tareas (`docs/context_agents.md`, `public/sw.js`, `src/app/api/radar/intake/route.ts`, etc.)
- No cambiar `package.json`, `package-lock.json`, `next.config.mjs` sin permiso explícito
