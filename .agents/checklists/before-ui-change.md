# Before UI Change Checklist

## Calm Design Guard
- [ ] The change reduces friction or cognitive load. If not, reject it.
- [ ] No new color tokens introduced without design system alignment.
- [ ] No hardcoded hex colors; use CSS custom properties.
- [ ] Contrast meets WCAG 2.2 AA minimum.
- [ ] Touch targets are at least 44×44px.

## Component Hygiene
- [ ] Inline editing preferred over modals for simple text changes.
- [ ] Cards remain scannable: type pill → title → meta → actions.
- [ ] Completed states use reduced opacity, not deletion or hiding.
- [ ] Shopping lists render as checklists, never as raw text blobs.

## State & Data
- [ ] UI reads from Dexie via `useLiveQuery` or equivalent.
- [ ] Mutations write to Dexie immediately; sync is background.
- [ ] No local React state duplicates what Dexie already holds.

## Responsive
- [ ] Layout works on 320px width.
- [ ] Horizontal scroll only where intended (chips, carousels).
- [ ] No layout shift on load.

## Accessibility
- [ ] Interactive elements have `aria-label` or visible text.
- [ ] Focus states are visible.
- [ ] Color is not the sole indicator of state (use icons, text, or opacity too).

## References
- `docs/FRONTEND_GUIDE.md`
- `docs/LIEV_PRODUCT_CONTEXT.md`
