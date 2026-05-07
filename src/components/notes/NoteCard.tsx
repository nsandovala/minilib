'use client';

import type { TimelineEntry } from '@/types';

interface NoteCardProps {
  note: TimelineEntry;
  onEdit: (note: TimelineEntry) => void;
  onDelete: (id: number) => void;
}

function formatRelativeDate(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'ahora';
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000);
    return `hace ${mins} min`;
  }
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `hace ${hours} h`;
  }
  if (diff < 172_800_000) return 'ayer';
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export default function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  return (
    <div
      className="glass-card relative overflow-hidden cursor-pointer active:scale-[0.99]"
      style={{ transition: 'transform 0.15s ease' }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent)',
        }}
      />
      <div style={{ padding: '18px 20px' }}>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {note.title || 'Sin título'}
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginTop: '6px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {note.text}
        </p>
        <div
          style={{
            marginTop: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
            }}
          >
            {formatRelativeDate(note.updatedAt ?? note.createdAt)}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(note);
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Editar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('¿Eliminar esta nota?')) {
                  onDelete(note.id!);
                }
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              aria-label="Eliminar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
