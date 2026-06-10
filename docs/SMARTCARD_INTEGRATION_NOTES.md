# SmartCard — Notas de Integración (2026-06-10)

## Estado
SmartCard está **implementado pero NO integrado** en TimelineView.

## ¿Por qué no se integró todavía?
La integración de SmartCard en TimelineView (commit 385a236) añadía:
- `border-left: 2px solid` con color por tipo
- Label del agente arriba de cada card
- Opacity transitions en done

**Problema:** Las cards quedaron "sobre bordeadas" (visualmente ruidosas) y rompieron el diseño limpio que tenía Liev. El usuario prefiere mantener la calma visual actual.

## Qué SÍ se mantuvo
- `SmartCard` component existe en `src/components/cards/SmartCard.tsx`
- `SmartCardTitle`, `SmartCardMeta`, `SmartCardNotePreview` helpers disponibles
- `getEntryTypeColor()`, `getEntryTypeLabel()` exportados
- `NoteReader` ya tiene reclasificación manual (Fase 2B)
- `background-reclassify` ya funciona (Fase 2C)

## Qué se revirtió
- TimelineView vuelve a usar `glass-card` genérico sin border-left
- Sin label del agente en cada card
- Diseño visual preservado exactamente como antes

## Cómo integrar en el futuro
Cuando se decida integrar SmartCard, debe ser:
1. **Opcional por tipo** — solo payment/health en "Ahora" usan border-left
2. **1px border** — 2px es demasiado grueso
3. **Sin label** — el color ya comunica el tipo
4. **Con A/B test** — verificar que no aumenta cognitive load
5. **Respetando el principio** — "sin esto, ¿puedo decidir si actuar?"

## Archivos involucrados
- `src/components/cards/SmartCard.tsx` — componente listo
- `src/components/TimelineView.tsx` — NO usa SmartCard (revertido)
- `src/components/notes/NoteReader.tsx` — SÍ usa SmartCard internamente (OK)
