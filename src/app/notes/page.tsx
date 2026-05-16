'use client';

import { useMemo, useState } from 'react';
import { deleteEntry } from '@/db/entries';
import { useEntries } from '@/hooks/useEntries';
import { getNoteEntries, queryEntries } from '@/core/queries/entry-queries';
import type { TimelineEntry } from '@/types';
import NoteCard from '@/components/notes/NoteCard';
import NoteEditor from '@/components/notes/NoteEditor';
import { NOTE_AGENT } from '@/core/card-agents';

export default function NotesPage() {
  const [search, setSearch] = useState('');
  const entries = useEntries();
  const notes = useMemo(
    () => queryEntries(getNoteEntries(entries), { search }),
    [entries, search]
  );
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<TimelineEntry | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteEntry(id);
    } catch {
      /* silent */
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notas</h1>
          <p className="page-subtitle">
            {notes.length === 0
              ? 'Tu libreta está vacía'
              : `${notes.length} nota${notes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          className="btn-icon tap-target"
          onClick={() => {
            setEditingNote(null);
            setShowEditor(true);
          }}
          aria-label="Nueva nota"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input-base"
            style={{ paddingLeft: '40px' }}
            placeholder="Buscar notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3" style={{ padding: '0 24px 24px' }}>
        {notes.length === 0 && search && (
          <div className="empty-state">
            Sin resultados para &quot;{search}&quot;
          </div>
        )}
        {notes.length === 0 && !search && (
          <div className="empty-state">
            <p>{NOTE_AGENT.ui.emptyState.title}</p>
            <p style={{ marginTop: '8px', fontSize: '13px' }}>
              {NOTE_AGENT.ui.emptyState.body}
            </p>
          </div>
        )}
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onEdit={(n) => {
              setEditingNote(n);
              setShowEditor(true);
            }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showEditor && (
        <NoteEditor
          note={editingNote ?? undefined}
          onSave={() => {
            setShowEditor(false);
            setEditingNote(null);
          }}
          onCancel={() => {
            setShowEditor(false);
            setEditingNote(null);
          }}
        />
      )}
    </div>
  );
}
