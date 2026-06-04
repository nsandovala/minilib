'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px 20px',
      }}
    >
      <div className="glass-card" style={{ maxWidth: '420px', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Error
        </p>
        <h1 style={{ margin: '10px 0 8px', fontSize: '28px' }}>Algo salió mal</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          No se pudo cargar esta vista. Puedes intentar de nuevo.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '18px',
            border: '1px solid var(--glass-border)',
            borderRadius: '999px',
            background: 'transparent',
            color: 'var(--text-primary)',
            padding: '10px 16px',
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
