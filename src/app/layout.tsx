import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/ui/BottomNav';
import NotificationBanner from '@/components/ui/NotificationBanner';
import AppInit from '@/components/ui/AppInit';

export const metadata: Metadata = {
  title: 'MiniLib',
  description: 'Tu libreta viva contextual, siempre contigo',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Liev',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#050508',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <div aria-hidden="true">
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
          <div className="bg-grid" />
        </div>
        <main style={{ position: 'relative', zIndex: 1, paddingBottom: '88px' }}>
          {children}
        </main>
        <NotificationBanner />
        <BottomNav />
        <AppInit />
      </body>
    </html>
  );
}
