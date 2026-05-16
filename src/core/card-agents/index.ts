// Card agent resolver — surface/display hints for already-classified entries.
// Read-only: never mutates entry data or reclassifies entries.
// Fallback: unknown types resolve to the note agent (notes surface).

import type { TimelineEntry } from '@/types';
import type { CardAgentConfig, CardAgentResolution, CardSurface } from './types.ts';
import { NOTE_AGENT }     from './note.agent.ts';
import { PAYMENT_AGENT }  from './payment.agent.ts';
import { PET_AGENT }      from './pet.agent.ts';
import { SHOPPING_AGENT } from './shopping.agent.ts';
import { HEALTH_AGENT }   from './health.agent.ts';
import { TASK_AGENT }     from './task.agent.ts';

export type { CardSurface, CardAgentConfig, CardAgentResolution } from './types.ts';

// ── Agent registry ─────────────────────────────────────────────────────────────

const ALL_AGENTS: CardAgentConfig[] = [
  NOTE_AGENT,
  PAYMENT_AGENT,
  PET_AGENT,
  SHOPPING_AGENT,
  HEALTH_AGENT,
  TASK_AGENT,
];

const AGENT_BY_TYPE = new Map<string, CardAgentConfig>(
  ALL_AGENTS.flatMap((agent) =>
    Array.isArray(agent.type)
      ? agent.type.map((t) => [t, agent] as const)
      : [[agent.type as string, agent]],
  ),
);

// ── Resolver ───────────────────────────────────────────────────────────────────

/**
 * Returns display/surface hints for an already-classified entry.
 * Never reclassifies or mutates the entry.
 *
 * Secondary surfaces (e.g. 'home') are included when:
 *   - entry is not done, AND
 *   - entry has a date OR a non-null amount (signals time/financial pressure)
 */
export function resolveCardAgent(entry: TimelineEntry): CardAgentResolution {
  const agent = AGENT_BY_TYPE.get(entry.type) ?? NOTE_AGENT;

  const deprioritized = entry.done;

  const addSecondary =
    !entry.done && (entry.date != null || (entry.amount ?? null) != null);

  const allSurfaces: CardSurface[] = [
    agent.surfaces.primary,
    ...(addSecondary ? agent.surfaces.secondary : []),
  ];

  return {
    agentId: agent.id,
    surface: agent.surfaces.primary,
    allSurfaces,
    calmExplanation: agent.ui.calmExplanation,
    deprioritized,
    label: agent.ui.label,
  };
}

/**
 * Convenience helper — returns only the primary surface for an entry.
 */
export function resolveSurfaceForEntry(entry: TimelineEntry): CardSurface {
  return resolveCardAgent(entry).surface;
}

/**
 * Returns the agent config for a given entry type, or undefined if unregistered.
 * Useful for reading UI copy (labels, empty states, correction hints) without
 * needing a full TimelineEntry.
 */
export function getAgentForType(type: string): CardAgentConfig | undefined {
  return AGENT_BY_TYPE.get(type);
}

export {
  NOTE_AGENT,
  PAYMENT_AGENT,
  PET_AGENT,
  SHOPPING_AGENT,
  HEALTH_AGENT,
  TASK_AGENT,
  ALL_AGENTS,
};
