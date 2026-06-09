'use client';

import type { TimelineEntry } from '@/types';

interface NoteReaderProps {
  note: TimelineEntry;
  onEdit: (note: TimelineEntry) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export default function NoteReader({ note, onEdit, onDelete, onClose }: NoteReaderProps) {
  const handleDelete = () => {
    if (window.confirm('¿Eliminar esta nota?')) {
      onDelete(note.id!);
      onClose();
    }
  };

  const handleEdit = () => {
    onEdit(note);
  };

  return (
    <div className="overlay" style={{ zIndex: 250 }}>
      <div className="overlay-topbar">
        <button type="button" className="btn-ghost tap-target" onClick={onClose}>
          ← Cerrar
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
          Nota
        </span>
        <div style={{ width: 80 }} />
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 24px 24px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
            margin: '0 0 16px',
            wordBreak: 'break-word',
          }}
        >
          {note.title || 'Sin título'}
        </h1>
        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.8,
            color: 'var(--text-secondary)',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {note.text}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '16px 24px calc(16px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid var(--divider)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="btn-primary tap-target"
          style={{ flex: 1 }}
          onClick={handleEdit}
        >
          Editar
        </button>
        <button
          type="button"
          className="tap-target"
          style={{
            width: '48px',
            borderRadius: '10px',
            background: 'rgba(196,112,112,0.12)',
            border: '1px solid rgba(196,112,112,0.25)',
            color: '#c47070',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'opacity 0.15s ease',
          }}
          onClick={handleDelete}
          aria-label="Eliminar"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
