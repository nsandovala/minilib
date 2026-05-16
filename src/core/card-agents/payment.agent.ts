// payment agent — financial obligations with high cost-of-forgetting
//
// YAML equivalent:
// ---
// id: payment
// type: payment
// surfaces:
//   primary: payments
//   secondary: [home]
// classification:
//   signals:
//     - pagar
//     - deuda
//     - cuenta
//     - vencimiento
//     - suscripción
//     - cuota
//     - arriendo
//     - hipoteca
//     - factura
//     - transferir
//     - amount (numeric field present)
//   negativeSignals: []
//   confidenceThreshold: 0.87
//   longFormGuard: false
// priority:
//   boostConditions:
//     - vence hoy
//     - overdue (date < today)
//     - amount present
//   suppressConditions:
//     - done=true
// ui:
//   label: Pago
//   calmExplanation: Pago pendiente. Lo puse arriba por costo de olvido.
//   emptyState:
//     title: Sin pagos pendientes
//     body: Cuando registres un pago o vencimiento aparecerá aquí.
//   correctionHint: Si no es un pago, muévelo a tareas o notas.
// correction:
//   allowedTargetTypes: [task, note]
// ---

import type { CardAgentConfig } from './types';

export const PAYMENT_AGENT = {
  id: 'payment',
  type: 'payment',

  surfaces: {
    primary: 'payments',
    secondary: ['home'],
  },

  classification: {
    signals: [
      'pagar', 'deuda', 'cuenta', 'vencimiento', 'suscripción',
      'cuota', 'arriendo', 'hipoteca', 'factura', 'transferir',
      'amount (campo numérico presente)',
    ],
    negativeSignals: [],
    confidenceThreshold: 0.87,
    longFormGuard: false,
  },

  priority: {
    boostConditions: [
      'vence hoy — sube al grupo Ahora',
      'overdue (date < today) — sube al grupo Ahora',
      'amount presente — señal de obligación concreta',
    ],
    suppressConditions: [
      'done=true — mueve al grupo completado',
    ],
  },

  ui: {
    label: 'Pago',
    calmExplanation: 'Pago pendiente. Lo puse arriba por costo de olvido.',
    emptyState: {
      title: 'Sin pagos pendientes',
      body: 'Cuando registres un pago o vencimiento aparecerá aquí.',
    },
    correctionHint: 'Si no es un pago, muévelo a tareas o notas.',
  },

  correction: {
    allowedTargetTypes: ['task', 'note'],
  },
} satisfies CardAgentConfig;
