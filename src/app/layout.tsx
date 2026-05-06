import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/ui/BottomNav';

export const metadata: Metadata = {
  title: 'MiniLibreta',
  description: 'Tu libreta personal offline',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'MiniLibreta',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
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
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased pb-20">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
