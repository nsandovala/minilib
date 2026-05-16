// shopping agent — structured list of items to buy; requires concrete shopping signal
//
// YAML equivalent:
// ---
// id: shopping
// type: shopping_list
// surfaces:
//   primary: purchases
//   secondary: [home]
// classification:
//   signals:
//     - supermercado
//     - feria
//     - farmacia
//     - lista de compras
//     - comprar
//     - ingredientes
//     - multiple items (2+) with known categories
//   negativeSignals:
//     - texto largo sin items concretos
//     - ideas/categorías sin intención de compra
//   confidenceThreshold: 0.87
//   longFormGuard: false
// priority:
//   boostConditions:
//     - items sin marcar presentes
//     - date = today
//   suppressConditions:
//     - done=true
//     - todos los items marcados
// ui:
//   label: Lista de compras
//   calmExplanation: Lista de compras detectada. Puedes marcar items en el momento de comprar.
//   emptyState:
//     title: Sin listas de compras
//     body: Escribe lo que necesitas comprar y lo organizaré automáticamente.
//   correctionHint: Si no es una lista de compras, muévelo a notas o tareas.
// correction:
//   allowedTargetTypes: [task, note]
// ---

import type { CardAgentConfig } from './types';

export const SHOPPING_AGENT = {
  id: 'shopping',
  type: 'shopping_list',

  surfaces: {
    primary: 'purchases',
    secondary: ['home'],
  },

  classification: {
    signals: [
      'supermercado', 'feria', 'farmacia',
      'lista de compras', 'comprar', 'ingredientes',
      'múltiples items (2+) con categorías conocidas',
    ],
    negativeSignals: [
      'texto largo sin items concretos',
      'ideas/categorías sin intención de compra explícita',
    ],
    confidenceThreshold: 0.87,
    longFormGuard: false,
  },

  priority: {
    boostConditions: [
      'items sin marcar presentes — lista activa',
      'date = today — compra programada',
    ],
    suppressConditions: [
      'done=true — todos los items comprados',
    ],
  },

  ui: {
    label: 'Lista de compras',
    calmExplanation: 'Lista de compras detectada. Puedes marcar items al comprar.',
    emptyState: {
      title: 'Sin listas de compras',
      body: 'Escribe lo que necesitas comprar y lo organizaré automáticamente.',
    },
    correctionHint: 'Si no es una lista de compras, muévelo a notas o tareas.',
  },

  correction: {
    allowedTargetTypes: ['task', 'note'],
  },
} satisfies CardAgentConfig;
