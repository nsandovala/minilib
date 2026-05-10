import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
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
          <div aria-hidden="true">
            <div className="bg-grain" />
          </div>
          <main style={{ position: 'relative', zIndex: 1, paddingBottom: '72px' }}>
            {children}
          </main>
          <NotificationBanner />
          <BottomNav />
          <AppInit />
        </body>
      </html>
    </ClerkProvider>
  );
}
