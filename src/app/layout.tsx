import type { Metadata, Viewport } from 'next';
import nextDynamic from 'next/dynamic';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import BottomNav from '@/components/ui/BottomNav';
import NotificationBanner from '@/components/ui/NotificationBanner';
import AppInit from '@/components/ui/AppInit';
import DebugPanelGate from '@/components/ui/DebugPanelGate';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

const PWA_ICON_VERSION = '20260513';
const DEFAULT_APP_URL = 'https://liev-ten.vercel.app';
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL;

export const dynamic = 'force-dynamic';

function getMetadataBase(url: string): URL {
  try {
    return new URL(url);
  } catch {
    return new URL(DEFAULT_APP_URL);
  }
}

const SpaceBackground = nextDynamic(
  () => import('@/components/ui/SpaceBackground'),
  { ssr: false }
);

const themeInitScript = `
(function() {
  try {
    var key = 'liev-theme-mode';
    var mode = window.localStorage.getItem(key);
    if (mode !== 'auto' && mode !== 'light' && mode !== 'dark') mode = 'auto';
    var resolved = mode === 'auto'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : mode;
    if (resolved !== 'light' && resolved !== 'dark') resolved = 'dark';
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch (error) {
    document.documentElement.dataset.themeMode = 'auto';
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
  }
})();
`;

export const metadata: Metadata = {
  title: 'Liev',
  description: 'Tu libreta viva contextual, siempre contigo',
  metadataBase: getMetadataBase(appUrl),
  manifest: `/manifest.json?v=${PWA_ICON_VERSION}`,
  icons: {
    icon: [
      { url: `/favicon.ico?v=${PWA_ICON_VERSION}`, type: 'image/x-icon' },
      { url: `/icons/icon-192-v${PWA_ICON_VERSION}.png`, sizes: '192x192', type: 'image/png' },
      { url: `/icons/icon-512-v${PWA_ICON_VERSION}.png`, sizes: '512x512', type: 'image/png' },
    ],
    shortcut: [`/favicon.ico?v=${PWA_ICON_VERSION}`],
    apple: [
      {
        url: `/icons/apple-touch-icon-v${PWA_ICON_VERSION}.png`,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Liev',
    statusBarStyle: 'black-translucent',
    startupImage: `/icons/apple-touch-icon-v${PWA_ICON_VERSION}.png`,
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
    <html lang="es" suppressHydrationWarning>
      <body>
        <ClerkProvider>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
          <ThemeProvider>
            <SpaceBackground />
            <div aria-hidden="true">
              <div className="bg-grain" />
            </div>
            <main className="content-layer">
              {children}
            </main>
            <NotificationBanner />
            <BottomNav />
            <AppInit />
            <DebugPanelGate />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
