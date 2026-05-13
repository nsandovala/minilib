'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { processInput, previewInput } from '@/core/agents/orchestrator';
import { addEntry } from '@/db/entries';
import type { EntryType } from '@/types';

interface UniversalInputProps {
  onEntryAdded: () => void;
  weatherHint?: string | null;
}

const TYPE_COLORS: Record<EntryType, string> = {
  note:          'var(--text-secondary)',
  task:          'var(--accent-primary)',
  reminder:      'var(--accent-warning)',
  health:        'var(--accent-success)',
  appointment:   'var(--accent-violet)',
  payment:       'var(--accent-human)',
  pet:           'var(--accent-human)',
  shopping_list: 'var(--accent-primary)',
};

const TYPE_LABELS: Record<EntryType, string> = {
  note:          'nota',
  task:          'tarea',
  reminder:      'recordatorio',
  health:        'salud',
  appointment:   'cita',
  payment:       'pago',
  pet:           'mascota',
  shopping_list: 'lista de compras',
};

/* ─── Token types ─────────────────────────────────────────────────────────── */

type TokenType = 'amount' | 'date' | 'time' | 'plain';

interface Token {
  text: string;
  type: TokenType;
}

const DATE_WORDS = new Set([
  'hoy','mañana','manana','lunes','martes','miercoles','miércoles',
  'jueves','viernes','sabado','sábado','domingo',
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]);

function tokenizeInput(text: string): Token[] {
  if (!text) return [];

  const chars: TokenType[] = new Array(text.length).fill('plain');

  // 1. Mark TIME ranges
  const timeRegex = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\ba\s+las?\s+\d\b/gi;
  let m: RegExpExecArray | null;
  while ((m = timeRegex.exec(text)) !== null) {
    for (let i = m.index; i < m.index + m[0].length; i++) chars[i] = 'time';
  }

  // 2. Mark AMOUNT ranges (skip already marked)
  const amountRegex = /\b\d{4,}|\d+[kK]\b|\d{1,3}(?:\.\d{3})+/g;
  while ((m = amountRegex.exec(text)) !== null) {
    let allPlain = true;
    for (let i = m.index; i < m.index + m[0].length; i++) {
      if (chars[i] !== 'plain') { allPlain = false; break; }
    }
    if (allPlain) {
      for (let i = m.index; i < m.index + m[0].length; i++) chars[i] = 'amount';
    }
  }

  // 3. Mark DATE words (skip already marked)
  const wordRegex = /\b[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]+\b/g;
  while ((m = wordRegex.exec(text)) !== null) {
    const word = m[0].toLowerCase();
    if (DATE_WORDS.has(word)) {
      let allPlain = true;
      for (let i = m.index; i < m.index + m[0].length; i++) {
        if (chars[i] !== 'plain') { allPlain = false; break; }
      }
      if (allPlain) {
        for (let i = m.index; i < m.index + m[0].length; i++) chars[i] = 'date';
      }
    }
  }

  // 4. Group consecutive chars into tokens
  const tokens: Token[] = [];
  let current = chars[0];
  let start = 0;
  for (let i = 1; i <= chars.length; i++) {
    if (i === chars.length || chars[i] !== current) {
      tokens.push({ text: text.slice(start, i), type: current });
      if (i < chars.length) {
        current = chars[i];
        start = i;
      }
    }
  }
  return tokens;
}

const TOKEN_STYLES: Record<TokenType, React.CSSProperties> = {
  amount: {
    color: '#7a9e7e',
    fontWeight: 600,
    background: 'rgba(122,158,126,0.12)',
    borderRadius: '3px',
    padding: '0 2px',
  },
  date: {
    color: '#c9a882',
    background: 'rgba(201,168,130,0.10)',
    borderRadius: '3px',
    padding: '0 2px',
  },
  time: {
    color: '#b09ab8',
    padding: '0 1px',
  },
  plain: {
    color: 'var(--text-primary)',
  },
};

const INPUT_FONT_STYLE: React.CSSProperties = {
  fontSize: '15px',
  fontFamily: 'var(--font)',
  fontWeight: 400,
  letterSpacing: 'normal',
  lineHeight: '22px',
};

const INPUT_CONTAINER_STYLE: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
  height: '46px',
  overflow: 'hidden',
};

const HIGHLIGHT_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 1,
  padding: '12px 10px',
  ...INPUT_FONT_STYLE,
  whiteSpace: 'nowrap',
  overflowX: 'auto',
  overflowY: 'hidden',
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
};

const REAL_INPUT_STYLE: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  height: '100%',
  background: 'transparent',
  border: 'none',
  padding: '12px 10px',
  outline: 'none',
  color: 'transparent',
  caretColor: 'var(--text-primary)',
  ...INPUT_FONT_STYLE,
  whiteSpace: 'nowrap',
  overflowX: 'auto',
  overflowY: 'hidden',
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
};

export default function UniversalInput({ onEntryAdded, weatherHint }: UniversalInputProps) {
  const [text, setText] = useState('');
  const [previewType, setPreviewType] = useState<EntryType | null>(null);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<string | null>(null);
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);

  const tokens = useMemo(() => tokenizeInput(text), [text]);

  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setIsIOS(ios)
  }, [])

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
    if (!text.trim() || saving || submittingRef.current) return;
    submittingRef.current = true;

    setSaving(true);
    setError(null);
    const trimmed = text.trim();

    try {
      const result = processInput(trimmed);

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
    } catch (err) {
      // Log safely in production (no user data)
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[Liev] addEntry failed:', err);
      }

      // Never lose the user's text — keep it in the input
      setError('error_al_guardar');
      // Auto-retry once after 500ms if it was a transient Dexie error
      setTimeout(() => {
        if (text.trim() === trimmed) {
          setError(null);
        }
      }, 500);
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
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
              ? { borderColor: 'rgba(122, 158, 126, 0.35)' }
              : error
              ? { borderColor: 'rgba(196, 112, 112, 0.35)' }
              : {}),
          }}
        >
          {/* Layered input container */}
          <div style={INPUT_CONTAINER_STYLE}>
            {/* Layer 1 — highlight */}
            {!isIOS && (
            <div
              ref={highlightRef}
              aria-hidden="true"
              style={HIGHLIGHT_STYLE}
            >
              {tokens.map((t, i) => (
                <span key={i} style={TOKEN_STYLES[t.type]}>
                  {t.text}
                </span>
              ))}
            </div>
            )}

            {/* Layer 2 — real input */}
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onScroll={(e) => {
                if (highlightRef.current) {
                  highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
              }}
              placeholder={
                text.length === 0 && weatherHint
                  ? `${weatherHint}... o escribe cualquier pendiente`
                  : '¿Qué pendiente tienes?'
              }
              style={{
                ...REAL_INPUT_STYLE,
                color: isIOS ? 'var(--text-primary)' : 'transparent',
              }}
              aria-label="Nueva entrada"
            />
          </div>

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
          {previewAmount !== null && (
            <span
              className="chip"
              style={{ fontSize: '10px', padding: '2px 7px' }}
            >
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(previewAmount)}
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
