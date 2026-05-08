# Payments — Control de Gastos Básico

**Archivo:** `src/app/payments/page.tsx`  
**Estado:** Implementado — MVP

---

## Qué hace

Convierte la pantalla de Pagos en un control básico de ingresos y egresos mensuales. Sin DB adicional, sin hooks nuevos.

---

## Estructura visual

```
┌─────────────────────────────────────────┐
│  Pagos                                  │
│  3 pendientes                           │
├─────────────────────────────────────────┤
│  INGRESO MENSUAL          $ [________]  │  ← editable, persiste
│                                         │
│  DISPONIBLE                             │  ← solo si income > 0
│  $XXX.XXX   ← rojo si negativo          │
│                                         │
│  Gastos $X   Pendiente $X   Pagado $X   │
│  [======           ] barra de progreso  │  ← verde→amber si excede
├─────────────────────────────────────────┤
│  [ buscar... ]                          │
├─────────────────────────────────────────┤
│  HISTORIAL                              │
│  ○  vie 8  Pagar luz       $35.000      │
│  ●  lun 4  Arriendo       $350.000      │  ← ● = pagado
└─────────────────────────────────────────┘
```

---

## Decisiones de diseño

| Decisión | Razón |
|---|---|
| Income en `localStorage` (`liev:monthly-income`) | Es configuración de usuario, no una entry. No contamina la DB de entries. |
| No usa `TimelineView` en el historial | El componente tiene badges e iconos. El historial de pagos necesita máxima densidad: fecha · título · monto en una línea. |
| Tres stats inline (Gastos / Pendiente / Pagado) | Muestra el estado completo del mes sin necesitar scroll. |
| Barra verde cuando ok, amber→rojo cuando excede | Feedback inmediato de salud financiera sin alertas intrusivas. |
| `available` muestra negativo en rojo | El rojo `#c47070` ya está en el sistema como `--accent-danger`. |
| Income es opcional | Si el usuario no lo configura, la UI se degrada correctamente mostrando solo gastos/pendiente/pagado. |

---

## Cálculos clave

```
totalExpenses  = sum(paymentEntries.amount)          // todos los pagos
pendingAmount  = sum(!done entries.amount)
paidAmount     = sum(done entries.amount)
available      = income - totalExpenses
spentPercent   = min((totalExpenses / income) * 100, 100)
isOverspent    = income > 0 && available < 0
```

---

## Persistencia

- `liev:monthly-income` → localStorage → número entero (CLP)
- Se carga en `useEffect` (client-only, evita SSR mismatch)
- Se guarda en `onBlur` o `Enter` del input

---

## Próximos pasos posibles (no implementados)

- Múltiples presupuestos por categoría (arriendo, servicios, comida)
- Historial mensual (guardar snapshots por mes en DB)
- Notificación cuando `spentPercent > 80%`
- Importar desde archivo (CSV de banco)
