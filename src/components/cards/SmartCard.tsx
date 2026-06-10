'use client';

import type { TimelineEntry } from '@/types';
import { getAgentForType } from '@/core/card-agents';

interface SmartCardProps {
  entry: TimelineEntry;
  onClick?: () => void;
  children?: React.ReactNode;
}

const TYPE_COLORS: Record<string, string> = {
  payment: '#c9a882',
  health: '#7a9e7e',
  appointment: '#7a9e7e',
  reminder: '#b8944e',
  task: '#9e8a72',
  pet: '#c9a882',
  note: '#a99e8e',
  shopping_list: '#8faa8b',
};

const TYPE_LABELS: Record<string, string> = {
  note: 'nota',
  task: 'tarea',
  reminder: 'recordatorio',
  health: 'salud',
  appointment: 'cita',
  payment: 'pago',
  pet: 'mascota',
  shopping_list: 'lista',
};

export function getEntryTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? 'rgba(245,240,235,0.34)';
}

export function getEntryTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export default function SmartCard({ entry, onClick, children }: SmartCardProps) {
  const agent = getAgentForType(entry.type);
  const label = agent?.ui.label ?? getEntryTypeLabel(entry.type);
  const color = getEntryTypeColor(entry.type);

  return (
    <div
      className="glass-card"
      onClick={onClick}
      style={{
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : undefined,
        opacity: entry.done ? 0.42 : 1,
        transition: 'opacity 0.2s ease',
        borderLeft: `2px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Type indicator */}
        <span
          style={{
            fontSize: '10px',
            padding: '2px 7px',
            borderRadius: '999px',
            border: `1px solid ${color}33`,
            background: `${color}14`,
            color,
            flexShrink: 0,
            lineHeight: 1.5,
            textTransform: 'lowercase',
          }}
        >
          {label}
        </span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * SmartCard content helpers for each type.
 * These render the collapsed state content for each entry type.
 */

export function SmartCardTitle({ title, done }: { title: string; done?: boolean }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: '13px',
        fontWeight: 500,
        color: done ? 'var(--text-secondary)' : 'var(--text-primary)',
        textDecoration: done ? 'line-through' : 'none',
        lineHeight: 1.42,
        wordBreak: 'break-word',
      }}
    >
      {title}
    </p>
  );
}

export function SmartCardMeta({ items }: { items: (string | null)[] }) {
  const valid = items.filter(Boolean) as string[];
  if (valid.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
      {valid.map((item, i) => (
        <span key={i} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function SmartCardNotePreview({ text }: { text: string }) {
  return (
    <div className="preview-fade" style={{ maxHeight: '3.2em', marginTop: '4px' }}>
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {text}
      </p>
    </div>
  );
}
