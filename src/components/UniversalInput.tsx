'use client';

import { useState, useRef, useEffect } from 'react';
import { processInput, previewInput } from '@/core/agents/orchestrator';
import { addEntry } from '@/db/entries';
import type { EntryType } from '@/types';

interface UniversalInputProps {
  onEntryAdded: () => void;
}

const QUICK_CHIPS = [
  { label: 'Compra', value: 'Comprar ' },
  { label: 'Pago', value: 'Pagar ' },
  { label: 'Salud', value: 'Tomar ' },
  { label: 'Mascota', value: 'Comprar comida para ' },
  { label: 'Casa', value: 'Comprar para la casa ' },
];

const TYPE_COLORS: Record<EntryType, string> = {
  note: 'var(--text-secondary)',
  task: 'var(--accent-primary)',
  reminder: 'var(--accent-warning)',
  health: 'var(--accent-success)',
  appointment: 'var(--accent-violet)',
  payment: 'var(--accent-human)',
  pet: 'var(--accent-human)',
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

  const applyQuickChip = (value: string) => {
    setText(value);
    inputRef.current?.focus();
  };

  return (
    <div style={{ padding: '0 20px' }}>
      <form onSubmit={handleSubmit}>
        <div
          className="glass-card"
          style={{
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'border-color 0.2s ease',
            ...(justSaved
              ? {
                  borderColor: 'rgba(122, 158, 126, 0.35)',
                }
              : error
              ? {
                  borderColor: 'rgba(196, 112, 112, 0.35)',
                }
              : {}),
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="¿Qué pendiente tienes?"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              padding: '12px 10px',
              fontSize: '15px',
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
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: text.trim() ? 'var(--accent-human)' : 'var(--bg-surface)',
              border: 'none',
              cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s ease',
              opacity: text.trim() ? 1 : 0.35,
              flexShrink: 0,
            }}
            aria-label="Guardar entrada"
          >
            {saving ? (
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(17,16,15,0.2)',
                  borderTopColor: 'var(--bg-void)',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }}
              />
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--bg-void)"
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

      <p
        style={{
          marginTop: '8px',
          paddingLeft: '4px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          letterSpacing: '0.01em',
        }}
      >
        Pagos, compras, salud, hogar, mascotas...
      </p>

      <div
        style={{
          marginTop: '10px',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="chip"
            onClick={() => applyQuickChip(chip.value)}
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '14px',
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '11px',
            color: 'var(--accent-danger)',
            paddingLeft: '4px',
          }}
        >
          {formatError(error)}
        </div>
      )}

      {previewType && !error && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'slide-down 0.2s ease-out',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: TYPE_COLORS[previewType],
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '11px',
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
              style={{ fontSize: '10px', padding: '2px 7px' }}
            >
              ${previewAmount.toLocaleString('es-CL')}
            </span>
          )}
          {previewDate && (
            <span
              className="chip"
              style={{ fontSize: '10px', padding: '2px 7px' }}
            >
              {formatDateShort(previewDate)}
            </span>
          )}
          {previewTime && (
            <span
              className="chip"
              style={{ fontSize: '10px', padding: '2px 7px' }}
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
