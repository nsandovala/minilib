// pet agent — concrete animal care actions; negative signals guard against false positives
//
// YAML equivalent:
// ---
// id: pet
// type: pet
// surfaces:
//   primary: pets
//   secondary: [home]
// classification:
//   signals:
//     - veterinario
//     - vacuna
//     - pipeta
//     - antiparasitario
//     - comida (near animal word)
//     - pastilla (near animal word)
//     - baño (near animal word)
//     - corte de pelo (near animal word)
//     - control (near animal word)
//     - llevar al vet
//     - arena (cat litter)
//   negativeSignals:
//     - investigación sobre mascotas
//     - módulo mascotas
//     - categoría mascotas
//     - sección mascotas
//     - gestión de mascotas
//   confidenceThreshold: 0.87
//   longFormGuard: false
// priority:
//   boostConditions:
//     - date = today
//     - overdue (date < today)
//   suppressConditions:
//     - done=true
//     - negative signal present → demote to note
// ui:
//   label: Mascota
//   calmExplanation: Pendiente de mascota detectado.
//   emptyState:
//     title: Sin pendientes de mascotas
//     body: Las citas veterinarias y cuidados de tus mascotas aparecerán aquí.
//   correctionHint: Si no es una acción de cuidado, muévelo a notas.
// correction:
//   allowedTargetTypes: [task, note]
// ---

import type { CardAgentConfig } from './types';

export const PET_AGENT = {
  id: 'pet',
  type: 'pet',

  surfaces: {
    primary: 'pets',
    secondary: ['home'],
  },

  classification: {
    signals: [
      'veterinario', 'vacuna', 'pipeta', 'antiparasitario',
      'comida (near animal word)', 'pastilla (near animal word)',
      'baño (near animal word)', 'corte de pelo (near animal word)',
      'control (near animal word)', 'llevar al vet', 'arena (cat litter)',
    ],
    negativeSignals: [
      'investigación sobre mascotas',
      'módulo mascotas',
      'categoría mascotas',
      'sección mascotas',
      'gestión de mascotas',
    ],
    confidenceThreshold: 0.87,
    longFormGuard: false,
  },

  priority: {
    boostConditions: [
      'date = today — sube al grupo Ahora',
      'overdue (date < today) — sube al grupo Ahora',
    ],
    suppressConditions: [
      'done=true — mueve al grupo completado',
      'negative signal presente — demote a note',
    ],
  },

  ui: {
    label: 'Mascota',
    calmExplanation: 'Pendiente de mascota detectado.',
    emptyState: {
      title: 'Sin pendientes de mascotas',
      body: 'Las citas veterinarias y cuidados de tus mascotas aparecerán aquí.',
    },
    correctionHint: 'Si no es una acción de cuidado, muévelo a notas.',
  },

  correction: {
    allowedTargetTypes: ['task', 'note'],
  },
} satisfies CardAgentConfig;
