import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import BottomNav from '@/components/ui/BottomNav';
import NotificationBanner from '@/components/ui/NotificationBanner';
import AppInit from '@/components/ui/AppInit';

const SpaceBackground = dynamic(
  () => import('@/components/ui/SpaceBackground'),
  { ssr: false }
);

const DebugPanel = dynamic(
  () => import('@/components/ui/DebugPanel'),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'Liev',
  description: 'Tu libreta viva contextual, siempre contigo',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Liev',
    statusBarStyle: 'black-translucent',
    startupImage: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0a0d',
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
    <ClerkProvider>
      <html lang="es">
        <body>
          <SpaceBackground />
          <div aria-hidden="true">
            <div className="bg-grain" />
          </div>
          <main className="content-layer" style={{ paddingBottom: '72px' }}>
            {children}
          </main>
          <NotificationBanner />
          <BottomNav />
          <AppInit />
          <DebugPanel />
        </body>
      </html>
    </ClerkProvider>
  );
}
