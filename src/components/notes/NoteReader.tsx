'use client';

import { useMemo, useState } from 'react';
import type { TimelineEntry } from '@/types';

interface NoteReaderProps {
  note: TimelineEntry;
  onEdit: (note: TimelineEntry) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  onRefresh?: () => void;
  isPinned?: boolean;
  onTogglePinned?: (note: TimelineEntry) => void;
}

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const timestampFormatter = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const amountFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(value: string): string {
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return dateFormatter.format(new Date(Number(year), Number(month) - 1, Number(day)));
  }

  const date = toDate(value);
  return date ? dateFormatter.format(date) : value;
}

function formatTimestamp(value: Date | string | null | undefined): string | null {
  const date = toDate(value);
  return date ? timestampFormatter.format(date) : null;
}

function hasMeaningfulUpdate(createdAt: Date | string, updatedAt?: Date | string | null): boolean {
  const created = toDate(createdAt);
  const updated = toDate(updatedAt);

  if (!created || !updated) return false;
  return Math.abs(updated.getTime() - created.getTime()) > 60_000;
}

function copyWithFallback(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20l4.6-1 9.6-9.6a2.1 2.1 0 0 0-3-3L5.6 16 4 20Z" />
      <path d="M13.6 7.4l3 3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.7 10.7l6.6-4.4" />
      <path d="M8.7 13.3l6.6 4.4" />
    </svg>
  );
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17.3 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

export default function NoteReader({ note, onEdit, onClose, isPinned = false, onTogglePinned }: NoteReaderProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');

  const noteText = useMemo(
    () => [note.title, note.text].filter(Boolean).join('\n\n'),
    [note.text, note.title],
  );

  const metadata = useMemo(() => {
    const items: string[] = [];

    if (note.date) items.push(formatDateValue(note.date));
    if (note.time) items.push(note.time);
    if (note.amount !== null && note.amount !== undefined) items.push(amountFormatter.format(note.amount));

    const createdAt = formatTimestamp(note.createdAt);
    if (createdAt) items.push(`Creada ${createdAt}`);

    if (hasMeaningfulUpdate(note.createdAt, note.updatedAt)) {
      const updatedAt = formatTimestamp(note.updatedAt);
      if (updatedAt) items.push(`Actualizada ${updatedAt}`);
    }

    return items;
  }, [note.amount, note.createdAt, note.date, note.time, note.updatedAt]);

  if (note.type !== 'note') return null;

  const handleEdit = () => {
    onEdit(note);
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(noteText);
      } else if (!copyWithFallback(noteText)) {
        throw new Error('Copy fallback failed');
      }

      setCopyState('copied');
    } catch {
      setCopyState('failed');
    } finally {
      window.setTimeout(() => setCopyState('idle'), 1800);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: note.title || 'Nota',
          text: noteText,
        });
        setShareState('shared');
      } else {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(noteText);
        } else if (!copyWithFallback(noteText)) {
          throw new Error('Share fallback copy failed');
        }
        setShareState('copied');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareState('failed');
    } finally {
      window.setTimeout(() => setShareState('idle'), 1800);
    }
  };

  const handleTogglePinned = () => {
    onTogglePinned?.(note);
  };

  const copyLabel = copyState === 'copied' ? 'Copiado' : copyState === 'failed' ? 'No se copió' : 'Copiar';
  const shareLabel = shareState === 'shared'
    ? 'Compartido'
    : shareState === 'copied'
    ? 'Copiado'
    : shareState === 'failed'
    ? 'No se compartió'
    : 'Compartir';
  const statusLabel = copyState !== 'idle' ? copyLabel : shareState !== 'idle' ? shareLabel : '';

  return (
    <div className="overlay note-reader-overlay" style={{ zIndex: 250 }}>
      <header className="overlay-topbar note-reader-topbar">
        <button type="button" className="note-reader-back tap-target" onClick={onClose}>
          ← Volver
        </button>

        <div className="note-reader-kicker" aria-label="Metadata de la nota">
          <span className="note-reader-type">Nota</span>
          {metadata.length > 0 && (
            <span className="note-reader-meta">{metadata.join(' · ')}</span>
          )}
        </div>

        <div className="note-reader-topbar-spacer" aria-hidden="true" />
      </header>

      <main className="note-reader-scroll">
        <article className="note-reader-sheet">
          <h1 className="note-reader-title">{note.title || 'Sin título'}</h1>
          <div className="note-reader-rule" aria-hidden="true" />
          <p className="note-reader-body">{note.text}</p>
        </article>
      </main>

      <aside className="note-reader-floating-actions" aria-label="Acciones de nota">
        <button
          type="button"
          className="note-reader-floating-action note-reader-floating-action-primary tap-target"
          onClick={handleEdit}
          aria-label="Editar nota"
          title="Editar"
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="note-reader-floating-action tap-target"
          onClick={handleCopy}
          aria-label={copyLabel}
          title={copyLabel}
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className="note-reader-floating-action tap-target"
          onClick={handleShare}
          aria-label={shareLabel}
          title={shareLabel}
        >
          <ShareIcon />
        </button>
        {onTogglePinned && (
          <button
            type="button"
            className="note-reader-floating-action tap-target"
            onClick={handleTogglePinned}
            aria-label={isPinned ? 'Quitar destacado' : 'Destacar nota'}
            aria-pressed={isPinned}
            title={isPinned ? 'Destacado' : 'Destacar'}
          >
            <StarIcon filled={isPinned} />
          </button>
        )}
        <span className="note-reader-action-status" aria-live="polite">
          {statusLabel}
        </span>
      </aside>
    </div>
  );
}
