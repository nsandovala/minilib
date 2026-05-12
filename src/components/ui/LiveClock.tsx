'use client';

import { useState, useEffect } from 'react';

export default function LiveClock(): JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    setMounted(true);

    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
      setDate(
        now.toLocaleDateString('es-CL', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      );
    };

    tick(); // immediate
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '1px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}
      >
        {time}
      </span>
      <span
        style={{
          fontSize: '9px',
          color: 'var(--text-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: 1,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {date}
      </span>
    </div>
  );
}
