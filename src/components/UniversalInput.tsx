'use client';

import { useState, useRef, useEffect } from 'react';
import { processInput, previewInput } from '@/core/agents/orchestrator';
import { addEntry } from '@/db/entries';
import type { EntryType } from '@/types';

interface UniversalInputProps {
  onEntryAdded: () => void;
}

const TYPE_COLORS: Record<EntryType, string> = {
  note: 'var(--text-secondary)',
  task: 'var(--accent-blue)',
  reminder: 'var(--accent-amber)',
  health: '#10b981',
  appointment: 'var(--accent-violet)',
  payment: '#f43f5e',
  pet: '#f97316',
};

const TYPE_LABELS: Record<EntryType, string> = {
  note: 'nota',
  task: 'tarea',
  reminder: 'recordatorio',
  health: 'salud',
  appointment: 'cita',
  payment: 'pago',
  pet: 'mascota',
};

export default function UniversalInput({ onEntryAdded }: UniversalInputProps) {
  const [text, setText] = useState('');
  const [previewType, setPreviewType] = useState<EntryType | null>(null);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<string | null>(null);
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const preview = previewInput(text);
    if (preview) {
      setPreviewType(preview.type);
      setPreviewDate(preview.date);
      setPreviewTime(preview.time);
      setPreviewAmount(preview.amount);
    } else {
      setPreviewType(null);
      setPreviewDate(null);
      setPreviewTime(null);
      setPreviewAmount(null);
    }
    setError(null);
  }, [text]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || saving) return;

    setSaving(true);
    setError(null);
    try {
      const result = processInput(text.trim());

      if (!result.success || !result.entry) {
        setError(result.error ?? 'error_desconocido');
        return;
      }

      await addEntry(result.entry);
      setText('');
      setPreviewType(null);
      setPreviewDate(null);
      setPreviewTime(null);
      setPreviewAmount(null);
      setJustSaved(true);
      onEntryAdded();
      setTimeout(() => setJustSaved(false), 1500);
    } catch {
      setError('error_al_guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '0 24px' }}>
      <form onSubmit={handleSubmit}>
        <div
          className="glass-card"
          style={{
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            ...(justSaved
              ? {
                  borderColor: 'rgba(16,185,129,0.4)',
                  boxShadow: '0 0 0 3px rgba(16,185,129,0.15)',
                }
              : error
              ? {
                  borderColor: 'rgba(239,68,68,0.4)',
                  boxShadow: '0 0 0 3px rgba(239,68,68,0.15)',
                }
              : {}),
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="¿Qué necesitas sacar de tu mente?"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              padding: '14px 12px',
              fontSize: '16px',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            aria-label="Nueva entrada"
          />
          <button
            type="submit"
            disabled={!text.trim() || saving}
            className="tap-target"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '16px',
              background: text.trim() ? 'var(--accent-blue)' : 'var(--bg-surface)',
              border: 'none',
              cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              opacity: text.trim() ? 1 : 0.4,
              flexShrink: 0,
            }}
            aria-label="Guardar entrada"
          >
            {saving ? (
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }}
              />
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={2.5}
                strokeLinecap="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#f43f5e',
            paddingLeft: '4px',
          }}
        >
          {formatError(error)}
        </div>
      )}

      {previewType && !error && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'slide-down 0.2s ease-out',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: TYPE_COLORS[previewType],
              boxShadow: `0 0 8px ${TYPE_COLORS[previewType]}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: TYPE_COLORS[previewType],
              textTransform: 'capitalize',
            }}
          >
            {TYPE_LABELS[previewType]}
          </span>
          {previewAmount && (
            <span
              className="chip"
              style={{ fontSize: '11px', padding: '3px 8px' }}
            >
              ${previewAmount.toLocaleString('es-CL')}
            </span>
          )}
          {previewDate && (
            <span
              className="chip"
              style={{ fontSize: '11px', padding: '3px 8px' }}
            >
              {formatDateShort(previewDate)}
            </span>
          )}
          {previewTime && (
            <span
              className="chip"
              style={{ fontSize: '11px', padding: '3px 8px' }}
            >
              {previewTime}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function formatError(code: string): string {
  const messages: Record<string, string> = {
    empty_input: 'Escribe algo primero',
    input_too_long: 'Demasiado largo (máx 500 caracteres)',
    unsafe_content: 'Contenido no permitido',
    input_too_short: 'Muy corto',
    error_al_guardar: 'No se pudo guardar',
    error_desconocido: 'Error desconocido',
  };
  return messages[code] || code;
}

function formatDateShort(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (dateStr === today) return 'hoy';
  if (dateStr === tomorrowStr) return 'mañana';

  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}
