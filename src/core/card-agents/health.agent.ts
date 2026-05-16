// health agent — medical events, appointments, and wellness actions
//
// YAML equivalent:
// ---
// id: health
// type: [health, appointment]
// surfaces:
//   primary: health
//   secondary: [home]
// classification:
//   signals:
//     - médico
//     - doctor
//     - hospital
//     - clínica
//     - examen
//     - análisis
//     - salud
//     - dentista
//     - psicólogo
//     - nutricionista
//     - kinesiólogo
//     - hora médica
//     - control médico
//     - operación
//     - cirugía
//     - medicamento
//   negativeSignals:
//     - investigación médica (long-form → note)
//   confidenceThreshold: 0.82
//   longFormGuard: false
// priority:
//   boostConditions:
//     - date = today
//     - overdue (date < today)
//     - appointment type
//   suppressConditions:
//     - done=true
// ui:
//   label: Salud
//   calmExplanation: Evento de salud próximo. Lo puse visible para que no se pierda.
//   emptyState:
//     title: Sin eventos de salud
//     body: Tus citas médicas y recordatorios de salud aparecerán aquí.
//   correctionHint: Si es una nota médica larga, muévelo a notas.
// correction:
//   allowedTargetTypes: [task, note]
// ---

import type { CardAgentConfig } from './types';

export const HEALTH_AGENT = {
  id: 'health',
  type: ['health', 'appointment'],

  surfaces: {
    primary: 'health',
    secondary: ['home'],
  },

  classification: {
    signals: [
      'médico', 'doctor', 'hospital', 'clínica', 'examen',
      'análisis', 'salud', 'dentista', 'psicólogo',
      'nutricionista', 'kinesiólogo', 'hora médica',
      'control médico', 'operación', 'cirugía', 'medicamento',
    ],
    negativeSignals: [
      'investigación médica extensa → long-form guard lo mueve a nota',
    ],
    confidenceThreshold: 0.82,
    longFormGuard: false,
  },

  priority: {
    boostConditions: [
      'date = today — sube al grupo Ahora',
      'overdue (date < today) — sube al grupo Ahora',
      'type = appointment — boost adicional',
    ],
    suppressConditions: [
      'done=true — mueve al grupo completado',
    ],
  },

  ui: {
    label: 'Salud',
    calmExplanation: 'Evento de salud próximo. Lo puse visible para que no se pierda.',
    emptyState: {
      title: 'Sin eventos de salud',
      body: 'Tus citas médicas y recordatorios de salud aparecerán aquí.',
    },
    correctionHint: 'Si es una nota médica larga, muévelo a notas.',
  },

  correction: {
    allowedTargetTypes: ['task', 'note'],
  },
} satisfies CardAgentConfig;
