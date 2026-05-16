'use client';

import { useCallback, useMemo } from 'react';
import type { TimelineEntry } from '@/types';
import { computePriorityScore } from '@/core/priority/priority-score';
import {
  getEntryDisplayType,
  getEntryDisplayTitle,
  getEntryNextStep,
  getEntryPriority,
  formatRelativeDate,
  isOverdue,
} from '@/lib/entries';
import { getAgentForType } from '@/core/card-agents';

interface NextBestActionProps {
  entries: TimelineEntry[];
}

const TYPE_ACCENT: Record<string, string> = {
  payment:       '#c9a882',
  health:        '#7a9e7e',
  appointment:   '#7a9e7e',
  pet:           '#c9a882',
  shopping_list: '#8faa8b',
  task:          'rgba(245,240,235,0.55)',
  reminder:      'rgba(245,240,235,0.55)',
  note:          'rgba(245,240,235,0.34)',
};

export default function NextBestAction({ entries }: NextBestActionProps) {
  const top = useMemo(() =>
    entries
      .filter((e) => !e.done)
      .map((e) => ({ entry: e, score: computePriorityScore(e) }))
      .filter(({ score }) => score >= 60)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ entry }) => entry),
    [entries],
  );

  const scrollToEntry = useCallback((localId: string) => {
    const el = document.getElementById(`timeline-entry-${localId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.outline = '1px solid rgba(201,168,130,0.4)';
    setTimeout(() => { el.style.outline = ''; }, 900);
  }, []);

  if (top.length === 0) return null;

  return (
    <div style={{ padding: '0 20px 8px' }}>
      <p style={{
        fontSize: '10px',
        fontWeight: 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'rgba(233,204,169,0.4)',
        margin: '0 0 8px 2px',
      }}>
        Ahora
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {top.map((entry) => {
          const displayType = getAgentForType(entry.type)?.ui.label ?? getEntryDisplayType(entry);
          const title = getEntryDisplayTitle(entry);
          const nextStep = getEntryNextStep(entry);
          const priority = getEntryPriority(entry);
          const overdue = isOverdue(entry);
          const accent = TYPE_ACCENT[entry.type] ?? 'rgba(245,240,235,0.34)';
          const dateLabel = entry.date ? formatRelativeDate(entry.date) : null;
          const dotColor = priority === 'urgent' ? '#c47070'
            : priority === 'important' ? '#c9a882'
            : 'rgba(245,240,235,0.18)';

          return (
            <button
              key={entry.localId}
              type="button"
              onClick={() => scrollToEntry(entry.localId)}
              aria-label={`Ir a: ${title}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '14px',
                background: 'rgba(255,248,240,0.024)',
                border: `1px solid ${priority === 'urgent' ? 'rgba(196,112,112,0.12)' : 'rgba(232,202,165,0.07)'}`,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.12s ease',
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.background = 'rgba(255,248,240,0.048)';
              }}
              onPointerUp={(e) => {
                const target = e.currentTarget;
                setTimeout(() => { target.style.background = 'rgba(255,248,240,0.024)'; }, 140);
              }}
              onPointerLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,248,240,0.024)';
              }}
            >
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: dotColor,
                marginTop: '5px',
                flexShrink: 0,
              }} />

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: accent,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    flexShrink: 0,
                  }}>
                    {displayType}
                  </span>
                  {(overdue || dateLabel) && (
                    <span style={{
                      fontSize: '10px',
                      color: overdue ? '#c47070' : 'rgba(233,204,169,0.4)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {overdue ? '· vencido' : `· ${dateLabel}`}
                    </span>
                  )}
                </div>
                <p style={{
                  margin: '0 0 2px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {title}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '11px',
                  color: 'rgba(245,240,235,0.34)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {nextStep}
                </p>
              </div>

              <span aria-hidden="true" style={{
                fontSize: '11px',
                color: 'rgba(232,202,165,0.22)',
                marginTop: '3px',
                flexShrink: 0,
                lineHeight: 1,
              }}>
                ↓
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
