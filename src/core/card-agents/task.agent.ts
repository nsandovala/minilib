// task agent — actionable to-dos and reminders without a specialized domain
//
// YAML equivalent:
// ---
// id: task
// type: [task, reminder]
// surfaces:
//   primary: todos
//   secondary: [home]
// classification:
//   signals:
//     - hacer
//     - completar
//     - revisar
//     - llamar
//     - enviar
//     - confirmar
//     - acordarse
//     - recordar
//     - no olvidar
//     - pendiente
//   negativeSignals:
//     - signals de pago presentes → payment gana
//     - signals de salud presentes → health gana
//     - signals de mascota presentes → pet gana
//   confidenceThreshold: 0.75
//   longFormGuard: false
// priority:
//   boostConditions:
//     - urgency keywords (urgente, ya, ahora, inmediato)
//     - date = today
//     - overdue (date < today)
//   suppressConditions:
//     - done=true
// ui:
//   label: Tarea
//   calmExplanation: Tarea pendiente detectada. La mantengo visible hasta que la completes.
//   emptyState:
//     title: Sin tareas pendientes
//     body: Tus tareas y recordatorios aparecerán aquí.
//   correctionHint: Si es un pago o evento de salud, puedes reclasificar.
// correction:
//   allowedTargetTypes: [note, payment, health]
// ---

import type { CardAgentConfig } from './types';

export const TASK_AGENT = {
  id: 'task',
  type: ['task', 'reminder'],

  surfaces: {
    primary: 'todos',
    secondary: ['home'],
  },

  classification: {
    signals: [
      'hacer', 'completar', 'revisar', 'llamar', 'enviar',
      'confirmar', 'acordarse', 'recordar', 'no olvidar', 'pendiente',
    ],
    negativeSignals: [
      'señales de pago presentes — payment agent toma prioridad',
      'señales de salud presentes — health agent toma prioridad',
      'señales de mascota presentes — pet agent toma prioridad',
    ],
    confidenceThreshold: 0.75,
    longFormGuard: false,
  },

  priority: {
    boostConditions: [
      'urgency keywords (urgente, ya, ahora, inmediato) — boost máximo',
      'date = today — sube al grupo Ahora',
      'overdue (date < today) — sube al grupo Ahora',
    ],
    suppressConditions: [
      'done=true — mueve al grupo completado',
    ],
  },

  ui: {
    label: 'Tarea',
    calmExplanation: 'Tarea pendiente detectada. La mantengo visible hasta que la completes.',
    emptyState: {
      title: 'Sin tareas pendientes',
      body: 'Tus tareas y recordatorios aparecerán aquí.',
    },
    correctionHint: 'Si es un pago o evento de salud, puedes reclasificar.',
  },

  correction: {
    allowedTargetTypes: ['note', 'payment', 'health'],
  },
} satisfies CardAgentConfig;
