'use client';

import type { TimelineEntry } from '@/types';
import { getCalendarMetadata } from '@/lib/entries';
import { sortCalendarEvents } from '@/core/calendar/event-parser';
import { shouldShowOriginalText } from '@/core/display/display-rules';

interface NoteCardProps {
  note: TimelineEntry;
  onRead: (note: TimelineEntry) => void;
  onEdit: (note: TimelineEntry) => void;
  onDelete: (id: number) => void;
}

function formatUpdatedAtLabel(date: Date): string {
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

function formatCalendarDateLabel(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).replace(/^\w/, (char) => char.toUpperCase());
}

export default function NoteCard({ note, onRead, onEdit, onDelete }: NoteCardProps) {
  const calendar = getCalendarMetadata(note);
  const calendarEvents = sortCalendarEvents(calendar?.events ?? []);
  const calendarDateLabel = formatCalendarDateLabel(note.date);
  const showCalendarOriginalText = shouldShowOriginalText(note, { expanded: true });

  return (
    <div
      className="glass-card relative overflow-hidden cursor-pointer active:scale-[0.99]"
      onClick={() => onRead(note)}
      style={{ transition: 'transform 0.15s ease' }}
    >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '20%',
            right: '20%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(201,168,130,0.3), transparent)',
          }}
        />
      <div style={{ padding: '14px 16px' }}>
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
        {calendar ? (
          <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
            {calendarDateLabel && (
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.45,
                }}
              >
                {calendarDateLabel}
              </p>
            )}

            {calendarEvents.length > 0 ? (
              <div style={{ display: 'grid', gap: '5px' }}>
                {calendarEvents.map((event) => (
                  <div
                    key={`${note.localId}-${event.order}-${event.time}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: '#c9a882',
                        flexShrink: 0,
                      }}
                    >
                      {event.time}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                    <span>{event.label || `Evento ${event.order}`}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '4px' }}>
                {calendar.expectedCount ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    {calendar.expectedCount} eventos por detallar
                  </p>
                ) : null}
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.45,
                  }}
                >
                  Agrega horarios para ordenar este día.
                </p>
              </div>
            )}

            {showCalendarOriginalText ? (
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.45,
                  margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {note.text}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="preview-fade" style={{ maxHeight: '3.2em', marginTop: '6px' }}>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {note.text}
            </p>
          </div>
        )}
        <div
          style={{
            marginTop: '10px',
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
            {formatUpdatedAtLabel(note.updatedAt ?? note.createdAt)}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="note-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(note);
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
              className="note-action-btn note-action-btn-danger"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('¿Eliminar esta nota?')) {
                  onDelete(note.id!);
                }
              }}
              aria-label="Eliminar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
