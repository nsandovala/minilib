import Link from 'next/link';

export default function NotFoundPage() {
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
          404
        </p>
        <h1 style={{ margin: '10px 0 8px', fontSize: '28px' }}>Página no encontrada</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Esa vista no existe o ya no está disponible.
        </p>
        <Link href="/" style={{ display: 'inline-block', marginTop: '18px', color: 'var(--accent-human)' }}>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
