// note agent — long-form text, research/document intent, default catch-all surface
//
// YAML equivalent:
// ---
// id: note
// type: note
// surfaces:
//   primary: notes
//   secondary: []
// classification:
//   signals:
//     - investigación
//     - análisis
//     - resumen
//     - notas sobre
//     - documento
//     - apuntes
//     - reflexión
//     - ideas
//   negativeSignals: []
//   confidenceThreshold: 0.75
//   longFormGuard: true
// priority:
//   boostConditions: []
//   suppressConditions:
//     - done=true (always visually deprioritized)
// ui:
//   label: Nota
//   calmExplanation: Guardé esto como nota para evitar ruido en tu flujo de trabajo.
//   emptyState:
//     title: Sin notas por ahora
//     body: Aquí aparecerán tus notas, reflexiones y documentos.
//   correctionHint: Si es una tarea o pago, puedes reclasificar desde el menú de la tarjeta.
// correction:
//   allowedTargetTypes: [task, reminder]
// ---

import type { CardAgentConfig } from './types';

export const NOTE_AGENT = {
  id: 'note',
  type: 'note',

  surfaces: {
    primary: 'notes',
    secondary: [],
  },

  classification: {
    signals: [
      'investigación', 'análisis', 'resumen', 'notas sobre',
      'documento', 'apuntes', 'reflexión', 'ideas',
    ],
    negativeSignals: [],
    confidenceThreshold: 0.75,
    longFormGuard: true,
  },

  priority: {
    boostConditions: [],
    suppressConditions: [
      'done=true — siempre se mueve al grupo completado',
    ],
  },

  ui: {
    label: 'Nota',
    calmExplanation: 'Guardé esto como nota para evitar ruido en tu flujo de trabajo.',
    emptyState: {
      title: 'Sin notas por ahora',
      body: 'Aquí aparecerán tus notas, reflexiones y documentos.',
    },
    correctionHint: 'Si es una tarea o pago, puedes reclasificar desde el menú de la tarjeta.',
  },

  correction: {
    allowedTargetTypes: ['task', 'reminder'],
  },
} satisfies CardAgentConfig;
