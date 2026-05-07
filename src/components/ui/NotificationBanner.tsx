'use client';

import { useState, useEffect } from 'react';

interface BannerItem {
  id: string;
  title: string;
  body: string;
}

export default function NotificationBanner() {
  const [banners, setBanners] = useState<BannerItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { title, body } = (e as CustomEvent<{ title: string; body: string }>).detail;
      const id = crypto.randomUUID();
      setBanners((prev) => [...prev.slice(-2), { id, title, body }]);
      setTimeout(() => {
        setBanners((prev) => prev.filter((b) => b.id !== id));
      }, 4000);
    };

    window.addEventListener('minilib:notify', handler);
    return () => window.removeEventListener('minilib:notify', handler);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[300] pointer-events-none flex flex-col gap-2"
      style={{ padding: '12px 16px' }}
    >
      {banners.map((banner) => (
        <div
          key={banner.id}
          className="glass-card pointer-events-auto flex justify-between items-start"
          style={{
            padding: '14px 16px',
            animation: 'slide-down 0.25s ease-out',
            borderColor: 'rgba(59,130,246,0.3)',
          }}
        >
          <div>
            <p style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>
              {banner.title}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {banner.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBanners((prev) => prev.filter((b) => b.id !== banner.id))}
            className="tap-target"
            style={{
              color: 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 4px',
            }}
            aria-label="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
