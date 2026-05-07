'use client';

import { useState, useEffect, useRef } from 'react';
import type { TimelineEntry } from '@/types';
import { createEntry, updateEntry } from '@/db/entries';

interface NoteEditorProps {
  note?: TimelineEntry;
  onSave: () => void;
  onCancel: () => void;
}

export default function NoteEditor({ note, onSave, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setBody(note.text);
    }
  }, [note]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      if (note?.id !== undefined) {
        await updateEntry(note.id, { title: title.trim(), text: body.trim() });
      } else {
        await createEntry({
          type: 'note',
          title: title.trim(),
          text: body.trim(),
          tags: ['note'],
        });
      }
      onSave();
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay">
      <div className="overlay-topbar">
        <button type="button" className="btn-ghost tap-target" onClick={onCancel}>
          ← Cancelar
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
          {note ? 'Editar nota' : 'Nueva nota'}
        </span>
        <button
          type="button"
          className="btn-primary tap-target"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px 16px',
          fontSize: '26px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          outline: 'none',
        }}
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Escribe aquí..."
        style={{
          flex: 1,
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '16px 24px',
          fontSize: '15px',
          lineHeight: 1.7,
          color: 'var(--text-secondary)',
          resize: 'none',
          outline: 'none',
          minHeight: 'calc(100vh - 200px)',
        }}
      />
    </div>
  );
}
