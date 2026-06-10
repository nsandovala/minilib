'use client';

import { useState } from 'react';
import type { TimelineEntry, EntryType } from '@/types';
import { reclassifyEntry } from '@/db/entries';
import { getAgentForType } from '@/core/card-agents';

interface NoteReaderProps {
  note: TimelineEntry;
  onEdit: (note: TimelineEntry) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  onRefresh?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  note: 'Nota',
  task: 'Tarea',
  payment: 'Pago',
  shopping_list: 'Lista de compras',
  health: 'Salud',
  appointment: 'Cita médica',
  pet: 'Mascota',
  reminder: 'Recordatorio',
};

const TYPE_OPTIONS: EntryType[] = ['note', 'task', 'payment', 'shopping_list', 'health', 'appointment', 'pet', 'reminder'];

export default function NoteReader({ note, onEdit, onDelete, onClose, onRefresh }: NoteReaderProps) {
  const [showReclassify, setShowReclassify] = useState(false);
  const [selectedType, setSelectedType] = useState<EntryType>(note.type);
  const [editAmount, setEditAmount] = useState<string>(note.amount?.toString() ?? '');
  const [editDate, setEditDate] = useState<string>(note.date ?? '');
  const [editTime, setEditTime] = useState<string>(note.time ?? '');
  const [saving, setSaving] = useState(false);

  const handleDelete = () => {
    if (window.confirm('¿Eliminar esta nota?')) {
      onDelete(note.id!);
      onClose();
    }
  };

  const handleEdit = () => {
    onEdit(note);
  };

  const handleReclassify = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const changes: Parameters<typeof reclassifyEntry>[1] = {
        type: selectedType !== note.type ? selectedType : undefined,
        amount: editAmount !== (note.amount?.toString() ?? '')
          ? editAmount ? Number(editAmount) : null
          : undefined,
        date: editDate !== (note.date ?? '')
          ? editDate || null
          : undefined,
        time: editTime !== (note.time ?? '')
          ? editTime || null
          : undefined,
      };

      await reclassifyEntry(note.id!, changes);
      setShowReclassify(false);
      onRefresh?.();
      onClose();
    } catch (err) {
      console.error('Failed to reclassify:', err);
    } finally {
      setSaving(false);
    }
  };

  const agent = getAgentForType(note.type);
  const allowedTargets = agent?.correction.allowedTargetTypes ?? [];
  const canReclassify = allowedTargets.length > 0;

  return (
    <div className="overlay" style={{ zIndex: 250 }}>
      <div className="overlay-topbar">
        <button type="button" className="btn-ghost tap-target" onClick={onClose}>
          ← Cerrar
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
          {TYPE_LABELS[note.type] ?? 'Entrada'}
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

        {/* Metadata display */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {note.date && (
            <span
              className="chip"
              style={{ fontSize: '11px', color: 'var(--text-muted)' }}
            >
              {note.date}
            </span>
          )}
          {note.time && (
            <span
              className="chip"
              style={{ fontSize: '11px', color: 'var(--text-muted)' }}
            >
              {note.time}
            </span>
          )}
          {note.amount !== null && note.amount !== undefined && (
            <span
              className="chip"
              style={{ fontSize: '11px', color: '#c9a882', fontWeight: 500 }}
            >
              ${note.amount.toLocaleString('es-CL')}
            </span>
          )}
        </div>

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

        {/* Reclassification UI */}
        {showReclassify && (
          <div
            style={{
              marginTop: '24px',
              padding: '16px',
              borderRadius: '12px',
              background: 'var(--divider-bg)',
              border: '1px solid var(--divider)',
            }}
          >
            <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
              Cambiar tipo
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${selectedType === t ? 'var(--accent-primary)' : 'var(--divider)'}`,
                    background: selectedType === t ? 'rgba(201,168,130,0.12)' : 'var(--bg-card)',
                    color: selectedType === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Quick corrections */}
            <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Monto
                </label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="Sin monto"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--divider-strong)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--divider-strong)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Hora
                  </label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--divider-strong)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowReclassify(false)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--divider)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReclassify}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: 'var(--bg-void)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
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
        {canReclassify && (
          <button
            type="button"
            onClick={() => setShowReclassify(!showReclassify)}
            style={{
              width: '48px',
              borderRadius: '10px',
              background: 'rgba(201,168,130,0.12)',
              border: '1px solid rgba(201,168,130,0.25)',
              color: '#c9a882',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            aria-label="Cambiar tipo"
            title="Cambiar tipo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
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
