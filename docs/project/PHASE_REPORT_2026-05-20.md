# Phase Report — 2026-05-20

## Context

Esta fase consolidó cuatro líneas de trabajo en Liev / minilib:

1. Calendario con metadata estructurada en `entry.metadata.calendar`
2. Resumen financiero con una sola fuente de verdad
3. Compatibilidad de sync cloud tras una discrepancia de schema
4. Limpieza cognitiva de UI para reducir copy redundante

## Goals Covered

- Mejorar parsing y rendering de agenda sin cambiar schema local
- Aclarar semántica de finanzas sin agregar dependencias
- Restaurar `/api/sync/pull` sin operaciones destructivas
- Reducir sobreexplicación en cards expandidas
- Mantener `npx tsc --noEmit`, tests y `npm run build` pasando

## Main Changes

### 1. Structured Calendar

Se agregó parsing puro para eventos de calendario en:

- `src/core/calendar/event-parser.ts`

Capacidades principales:

- detección de días y fechas en español
- detección de conteos como `2 eventos` / `dos eventos`
- detección de ordinales como `primero` / `segundo`
- detección de horas `13:00`, `19:30`, `5pm`, `9:30pm`
- captura de etiquetas opcionales por evento

Formato soportado en metadata:

```ts
{
  calendar: {
    kind: "multi_event" | "single_event",
    expectedCount?: number,
    events: [
      { order: 1, time: "17:30", label: "Partido" },
      { order: 2, time: "21:30", label: "Cena" }
    ]
  }
}
```

UI actualizada:

- `src/components/MiniCalendar.tsx`
- `src/components/TimelineView.tsx`
- `src/components/notes/NoteCard.tsx`

Comportamiento:

- si hay eventos, se muestran ordenados por hora
- si solo existe `expectedCount`, se muestra estado pendiente de detalle
- el texto original deja de competir con la estructura del día

### 2. Finance Summary

Se creó el módulo:

- `src/core/finance/summary.ts`

API principal:

- `computeFinanceSummary(entries)`

Salidas:

- `incomeTotal`
- `expenseTotal`
- `availableProjected`
- `pendingExpenseTotal`
- `paidExpenseTotal`
- `pendingIncomeTotal`
- `resolvedIncomeTotal`

La vista de pagos ahora usa este resumen como fuente de verdad:

- `src/app/payments/page.tsx`

Además:

- el tab de egresos excluye ingresos
- solo entradas `type === "payment"` con monto participan en finanzas
- shopping lists sin monto no contaminan la vista financiera

### 3. Sync Compatibility Fix

Se detectó una falla de producción en sync cloud:

- el código Drizzle esperaba `entries.dedupe_key`
- la tabla real tenía `deleted_at`
- la tabla real no tenía `dedupe_key`

Impacto:

- `/api/sync/pull` caía en `500`

Acciones:

- se agregó migración de compatibilidad:
  - `drizzle/0001_sync_compat_entries.sql`
- se reforzó la capa cloud:
  - `src/db/cloud/queries.ts`
- se endureció el manejo seguro de errores:
  - `src/app/api/sync/pull/route.ts`

Objetivo de esta parte:

- restaurar compatibilidad sin borrar datos ni tocar sync client

### 4. Cognitive UI Cleanup

Se creó:

- `src/core/display/display-rules.ts`

Helpers:

- `shouldShowCalmExplanation(entry, context)`
- `shouldShowCorrectionHint(entry, context)`
- `shouldShowOriginalText(entry, context)`
- `getCalendarDisplayCopy(entry)`

Efecto:

- ya no se muestra copy genérico en todas las cards expandidas
- `Detalle original` se vuelve condicional
- notas con calendario muestran estructura antes que texto bruto
- calendario usa copy más específico:
  - `Evento agendado`
  - `Agenda del día`
  - `Día con eventos por confirmar`

También se corrigió:

- filtro del chip `calendario` en `src/app/page.tsx`
- safe area inferior para evitar que BottomNav tape la última card
- pequeñas mejoras de performance en `MiniCalendar` y `TimelineView`

## Tests and Validation

Validaciones ejecutadas durante esta fase:

- `npx tsc --noEmit`
- `node --experimental-strip-types --test tests/*.test.mjs`
- `npm run build`

Tests agregados:

- `tests/calendar-event-parser.test.mjs`
- `tests/finance-summary.test.mjs`
- `tests/display-rules.test.mjs`

## Relevant Files

- `src/core/calendar/event-parser.ts`
- `src/core/finance/summary.ts`
- `src/core/display/display-rules.ts`
- `src/components/MiniCalendar.tsx`
- `src/components/TimelineView.tsx`
- `src/components/notes/NoteCard.tsx`
- `src/app/page.tsx`
- `src/app/payments/page.tsx`
- `src/db/cloud/queries.ts`
- `src/app/api/sync/pull/route.ts`
- `drizzle/0001_sync_compat_entries.sql`

## Remaining Risks

- Las heurísticas de ambigüedad y confianza pueden requerir ajuste con uso real
- Cualquier nueva superficie que use `TimelineView` debería pasar `currentSurface`
- `public/sw.js` puede cambiar por build; no debe entrar a commit si solo fue regenerado
- El naming legacy de algunas vistas, como `/todos`, sigue pendiente de revisión funcional

## Current Outcome

Estado al cierre de esta fase:

- agenda estructurada funcionando
- finanzas más claras y consistentes
- sync cloud compatible con schema real
- menos ruido cognitivo en la UI
- build y tests pasando
