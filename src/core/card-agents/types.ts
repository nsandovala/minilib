// Card agent config types — display/surface hints only, never mutate entry data.
//
// YAML equivalent structure (for documentation purposes):
//
// id: string
// type: string | string[]
// surfaces:
//   primary: CardSurface
//   secondary: CardSurface[]
// classification:
//   signals: string[]
//   negativeSignals: string[]
//   confidenceThreshold: number
//   longFormGuard: boolean
// priority:
//   boostConditions: string[]
//   suppressConditions: string[]
// ui:
//   label: string
//   calmExplanation: string
//   emptyState:
//     title: string
//     body: string
//   correctionHint: string
// correction:
//   allowedTargetTypes: string[]

export type CardSurface = 'home' | 'notes' | 'payments' | 'pets' | 'health' | 'todos' | 'purchases';

export interface CardAgentConfig {
  id: string;
  type: string | string[];

  surfaces: {
    primary: CardSurface;
    secondary: CardSurface[];
  };

  classification: {
    signals: string[];
    negativeSignals: string[];
    confidenceThreshold: number;
    longFormGuard: boolean;
  };

  priority: {
    boostConditions: string[];
    suppressConditions: string[];
  };

  ui: {
    label: string;
    calmExplanation: string;
    emptyState: {
      title: string;
      body: string;
    };
    correctionHint: string;
  };

  correction: {
    allowedTargetTypes: string[];
  };
}

export interface CardAgentResolution {
  agentId: string;
  surface: CardSurface;
  allSurfaces: CardSurface[];
  calmExplanation: string;
  deprioritized: boolean;
  label: string;
}
