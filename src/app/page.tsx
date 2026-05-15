'use client';

import Link from 'next/link';
import type { CSSProperties, SVGProps } from 'react';
import { useMemo, useState, useEffect } from 'react';
import { useAuth, UserButton } from '@clerk/nextjs';
import { useEntries } from '@/hooks/useEntries';
import {
  getPendingCount,
  getPurchaseEntries,
  getPaymentEntries,
  getHealthEntries,
  getPetEntries,
} from '@/core/queries/entry-queries';
import UniversalInput from '@/components/UniversalInput';
import TimelineView from '@/components/TimelineView';
import MiniCalendar from '@/components/MiniCalendar';
import LiveClock from '@/components/ui/LiveClock';
import WeatherPill from '@/components/ui/WeatherPill';
import { getLocationAndWeather } from '@/lib/weather';
import type { ShoppingMetadata, TimelineEntry } from '@/types';

type ChipFilter = 'all' | 'compra' | 'pago' | 'salud' | 'mascota' | 'casa' | 'calendario';

type OrbitItem = {
  id: string;
  top: string;
  left: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
};

const CHIPS: { id: ChipFilter; label: string }[] = [
  { id: 'compra', label: 'Compra' },
  { id: 'pago', label: 'Pago' },
  { id: 'salud', label: 'Salud' },
  { id: 'mascota', label: 'Mascota' },
  { id: 'casa', label: 'Casa' },
  { id: 'calendario', label: 'Calendario' },
];

const ORBIT_ITEMS: OrbitItem[] = [
  { id: 'compras',  top: '12%', left: '50%', icon: ShoppingIcon },
  { id: 'salud',    top: '28%', left: '79%', icon: HealthIcon   },
  { id: 'lista',    top: '68%', left: '76%', icon: NotesIcon    },
  { id: 'mascotas', top: '84%', left: '50%', icon: PawIcon      },
  { id: 'casa',     top: '68%', left: '24%', icon: HomeIcon     },
  { id: 'pagos',    top: '28%', left: '21%', icon: WalletIcon   },
];

function applyChip(entries: TimelineEntry[], chip: ChipFilter): TimelineEntry[] {
  switch (chip) {
    case 'compra': return getPurchaseEntries(entries);
    case 'pago': return getPaymentEntries(entries);
    case 'salud': return getHealthEntries(entries);
    case 'mascota': return getPetEntries(entries);
    case 'casa': return entries.filter((e) => e.type === 'task');
    default: return entries; // 'calendario' and 'all' show everything
  }
}

function CalendarIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  );
}

function ShoppingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 7h12l-1.1 10.2a2 2 0 0 1-2 1.8H9.1a2 2 0 0 1-2-1.8L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </svg>
  );
}

function WalletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 15.5v-7Z" />
      <path d="M4 9h13.5A2.5 2.5 0 0 1 20 11.5v1A2.5 2.5 0 0 1 17.5 15H4" />
      <circle cx="15.5" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HealthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
      <path d="M8 12h2l1.2-2.3L13 14l1.2-2H16" />
    </svg>
  );
}

function PawIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="7.5" cy="8" rx="1.7" ry="2.2" />
      <ellipse cx="12" cy="6.5" rx="1.7" ry="2.2" />
      <ellipse cx="16.5" cy="8" rx="1.7" ry="2.2" />
      <path d="M12 19.5c3 0 5-1.8 5-4 0-1.7-1.1-3.1-2.8-3.8-.9-.4-1.8.2-2.2 1-.4-.8-1.3-1.4-2.2-1C8 12.4 7 13.8 7 15.5c0 2.2 2 4 5 4Z" />
    </svg>
  );
}

function NotesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 4.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z" />
      <path d="M15 4.5V9h4" />
      <path d="M9 12.5h6" />
      <path d="M9 16h4.5" />
    </svg>
  );
}

function PenStrokeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m4 20 4.5-1 9.8-9.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" />
      <path d="m13.5 7.5 3 3" />
    </svg>
  );
}

function ScanStackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 4.5h10" />
      <path d="M5 9h14" />
      <path d="M7 13.5h10" />
      <path d="M9 18h6" />
    </svg>
  );
}

function CheckStackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6.5 12 3.2 3.2L17.5 7.5" />
      <path d="M6 18.5h12" />
    </svg>
  );
}

function DailySummary({ entries }: { entries: TimelineEntry[] }) {
  const today = new Date().toISOString().split('T')[0];

  const todayCount = entries.filter((entry) => entry.date === today && !entry.done).length;
  const pendingPayments = entries.filter((entry) => entry.type === 'payment' && !entry.done).length;
  const shoppingEstimated = entries
    .filter((entry) => entry.type === 'shopping_list' && !entry.done)
    .reduce((sum, entry) => {
      const meta = entry.metadata as ShoppingMetadata | undefined;
      const estimated = meta?.progress?.totalEstimated ?? 0;
      const fallback = estimated > 0 ? estimated : (entry.amount ?? 0);
      return sum + fallback;
    }, 0);

  return (
    <div
      className="glass-card"
      style={{
        margin: '14px 20px 0',
        padding: '12px 14px',
        borderRadius: '18px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '10px',
      }}
    >
      <SummaryCell label="Hoy" value={todayCount} />
      <SummaryCell label="Compras est." value={shoppingEstimated} money />
      <SummaryCell label="Pagos pend." value={pendingPayments} />
    </div>
  );
}

function SummaryCell({ label, value, money }: { label: string; value: number; money?: boolean }) {
  const display = money
    ? value > 0
      ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value)
      : '—'
    : String(value);

  return (
    <div>
      <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: money ? '13px' : '18px', color: 'var(--text-primary)', fontWeight: 600 }}>
        {display}
      </p>
    </div>
  );
}

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const entries = useEntries();
  const [activeChip, setActiveChip] = useState<ChipFilter>('all');

  const filteredEntries = useMemo(
    () => applyChip(entries, activeChip),
    [entries, activeChip],
  );

  const pendingCount = useMemo(() => getPendingCount(entries), [entries]);
  const handleRefresh = () => void 0;
  const [weatherHint, setWeatherHint] = useState<string | null>(null);

  useEffect(() => {
    const checkWeather = async () => {
      const w = await getLocationAndWeather();
      if (w?.suggestion) setWeatherHint(w.suggestion);
    };
    checkWeather();
  }, []);

  const toggleChip = (chip: ChipFilter) => {
    setActiveChip((prev) => (prev === chip ? 'all' : chip));
  };

  const scrollToHowItWorks = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById('como-funciona')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const showCalendar = activeChip === 'calendario';

  if (!isLoaded) {
    return (
      <div style={{ minHeight: '100vh', padding: '36px 24px 0' }}>
        <div
          className="glass-card"
          style={{
            maxWidth: '520px',
            margin: '0 auto',
            padding: '28px 24px',
            opacity: 0.7,
          }}
        >
          <div style={{ width: '84px', height: '14px', borderRadius: '999px', background: 'rgba(255,248,240,0.08)' }} />
          <div style={{ width: '220px', height: '12px', borderRadius: '999px', background: 'rgba(255,248,240,0.06)', marginTop: '12px' }} />
          <div style={{ width: '180px', height: '12px', borderRadius: '999px', background: 'rgba(255,248,240,0.05)', marginTop: '8px' }} />
          <div style={{ width: '96px', height: '38px', borderRadius: '14px', background: 'rgba(201,168,130,0.14)', marginTop: '24px' }} />
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="landing-root">
        <main className="landing-main">
          {/* Brand — top-left */}
          <header className="landing-header">
            <div className="landing-brand-mark" aria-hidden="true">
              <span>Li</span>
            </div>
            <span className="landing-brand-name">Liev</span>
          </header>

          {/* Copy — left-aligned */}
          <div className="landing-content">
            <p className="landing-eyebrow">Liev</p>
            <h1 className="landing-title">Bienvenido a Liev</h1>
            <p className="landing-subtitle">Una libreta tranquila para lo cotidiano.</p>
            <div className="landing-divider" aria-hidden="true" />
            <p className="landing-body">
              Ordena pagos, compras, salud, casa, mascotas y pendientes diarios en un solo lugar.
            </p>
          </div>

          {/* Orbit — fills the middle */}
          <div className="landing-orbit-wrap" aria-hidden="true">
            <div className="orbital-stage">
              <div className="orbital-aura" />
              <div className="orbital-ring orbital-ring-outer" />
              <div className="orbital-ring orbital-ring-inner" />
              <div className="orbital-core">
                <div className="orbital-core-mark">Li</div>
              </div>
              {ORBIT_ITEMS.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="orbital-node"
                    style={{ top: item.top, left: item.left, animationDelay: `${i * -1.3}s` } as CSSProperties}
                  >
                    <div className="orbital-node-body">
                      <Icon width={18} height={18} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="landing-actions">
            <Link href="/sign-in" className="landing-enter-btn">
              <span>Entrar</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
            <a href="#como-funciona" className="landing-link" onClick={scrollToHowItWorks}>
              Ver cómo funciona <span aria-hidden="true">›</span>
            </a>
          </div>

          {/* Footer */}
          <footer className="landing-footer">
            <span className="landing-footer-item">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Privado por diseño
            </span>
            <span>Hecho por AMON 360</span>
          </footer>
        </main>

        <section id="como-funciona" className="landing-flow">
          <div className="landing-flow-card glass-card">
            <p className="landing-flow-title">Cómo funciona</p>
            <div className="landing-flow-steps">
              <article>
                <div className="landing-step-top">
                  <span>01</span>
                  <div className="landing-step-icon" aria-hidden="true">
                    <PenStrokeIcon width={18} height={18} />
                  </div>
                </div>
                <h2>Escribe como piensas</h2>
                <p>Ejemplo: "pagar internet viernes 29990"</p>
              </article>
              <article>
                <div className="landing-step-top">
                  <span>02</span>
                  <div className="landing-step-icon" aria-hidden="true">
                    <ScanStackIcon width={18} height={18} />
                  </div>
                </div>
                <h2>Liev lo ordena</h2>
                <p>Detecta tipo, fecha, monto y categoría.</p>
              </article>
              <article>
                <div className="landing-step-top">
                  <span>03</span>
                  <div className="landing-step-icon" aria-hidden="true">
                    <CheckStackIcon width={18} height={18} />
                  </div>
                </div>
                <h2>Revisa y marca</h2>
                <p>Usa compras, pagos, salud, mascotas o notas desde una sola app.</p>
              </article>
            </div>
            <p className="landing-flow-closing">
              Sin formularios eternos. Sin ruido. Solo anotas, y Liev ordena.
            </p>
          </div>
        </section>

        <footer className="landing-footer">
          <span>Privado por diseño</span>
          <span>Hecho por AMON 360</span>
        </footer>

        <style jsx>{`
          /* ── Shell ────────────────────────────────────────────────── */
          .landing-main {
            min-height: 100svh;
            max-width: 420px;
            margin: 0 auto;
            padding: max(env(safe-area-inset-top), 20px) 24px 0;
            display: flex;
            flex-direction: column;
          }

          /* ── Header ───────────────────────────────────────────────── */
          .landing-header {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: fit-content;
            margin-bottom: 22px;
          }

          .landing-brand-mark {
            width: 26px;
            height: 26px;
            border-radius: 8px;
            display: grid;
            place-items: center;
            color: rgba(241, 210, 171, 0.9);
            font-size: 11px;
            font-weight: 600;
            letter-spacing: -0.05em;
            border: 1px solid rgba(232, 202, 165, 0.14);
            background: linear-gradient(180deg, rgba(255,248,240,0.06), rgba(201,168,130,0.02));
          }

          .landing-brand-name {
            color: rgba(223, 192, 155, 0.82);
            font-size: 15px;
            font-weight: 500;
            letter-spacing: -0.02em;
          }

          /* ── Copy ─────────────────────────────────────────────────── */
          .landing-content {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
          }

          .landing-eyebrow {
            margin: 0 0 6px;
            color: rgba(233, 204, 169, 0.52);
            font-size: 12px;
            font-weight: 400;
            letter-spacing: 0.01em;
          }

          .landing-title {
            margin: 0 0 6px;
            color: rgba(230, 198, 160, 0.95);
            font-size: clamp(28px, 8vw, 36px);
            line-height: 1.05;
            letter-spacing: -0.03em;
            font-weight: 600;
          }

          .landing-subtitle {
            margin: 0;
            color: rgba(245, 240, 235, 0.72);
            font-size: 16px;
            line-height: 1.35;
          }

          .landing-divider {
            width: 32px;
            height: 1px;
            background: linear-gradient(90deg, rgba(201, 168, 130, 0.55), transparent);
            margin: 13px 0;
          }

          .landing-body {
            margin: 0;
            color: rgba(245, 240, 235, 0.44);
            font-size: 14px;
            line-height: 1.55;
            max-width: 32ch;
          }

          /* ── Orbit — fills the middle ─────────────────────────────── */
          .landing-orbit-wrap {
            flex: 1;
            min-height: 220px;
            max-height: 320px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px 0;
          }

          .orbital-stage {
            position: relative;
            width: 260px;
            height: 260px;
          }

          .orbital-aura,
          .orbital-ring,
          .orbital-core,
          .orbital-node {
            position: absolute;
          }

          .orbital-aura {
            inset: 18%;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(201, 168, 130, 0.14), rgba(201, 168, 130, 0.04) 52%, transparent 72%);
            filter: blur(20px);
          }

          .orbital-ring {
            inset: 50%;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            border: 1px solid rgba(230, 196, 160, 0.13);
          }

          .orbital-ring-outer { width: 200px; height: 200px; }
          .orbital-ring-inner { width: 138px; height: 138px; opacity: 0.4; }

          .orbital-core {
            left: 50%;
            top: 50%;
            width: 72px;
            height: 72px;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            display: grid;
            place-items: center;
            background:
              radial-gradient(circle at 50% 38%, rgba(255,255,255,0.055), transparent 32%),
              radial-gradient(circle at 50% 50%, rgba(235, 196, 146, 0.14), rgba(18, 15, 11, 0.96) 78%);
            border: 1px solid rgba(236, 204, 167, 0.14);
            box-shadow: 0 0 28px rgba(201, 168, 130, 0.11);
          }

          .orbital-core-mark {
            color: rgba(255, 221, 168, 0.85);
            font-size: 24px;
            font-weight: 500;
            letter-spacing: -0.06em;
            animation: starPulse 6s ease-in-out infinite;
          }

          .orbital-node {
            transform: translate(-50%, -50%);
            animation: orbitalFloat 8s ease-in-out infinite;
          }

          .orbital-node-body {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            color: rgba(235, 201, 164, 0.78);
            background: rgba(255, 248, 240, 0.022);
            border: 1px solid rgba(232, 202, 165, 0.1);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
            backdrop-filter: blur(10px);
          }

          /* ── CTA ──────────────────────────────────────────────────── */
          .landing-actions {
            padding: 6px 0 0;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }

          .landing-enter-btn {
            display: flex;
            width: 100%;
            height: 56px;
            border-radius: 16px;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
            font-size: 17px;
            font-weight: 600;
            letter-spacing: -0.01em;
            color: rgba(230, 198, 160, 0.95);
            background: rgba(201, 168, 130, 0.14);
            border: 1px solid rgba(230, 198, 160, 0.45);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
          }

          .landing-enter-btn:hover {
            transform: translateY(-1px);
            background: rgba(201, 168, 130, 0.22);
            border-color: rgba(230, 198, 160, 0.6);
          }

          .landing-link {
            font-size: 14px;
            color: rgba(233, 204, 169, 0.56);
            text-decoration: none;
            transition: opacity 180ms ease;
          }

          .landing-link:hover { opacity: 0.8; }

          /* ── Footer ───────────────────────────────────────────────── */
          .landing-footer {
            margin-top: 16px;
            padding: 0 0 max(env(safe-area-inset-bottom), 16px);
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: rgba(245, 240, 235, 0.28);
            font-size: 11px;
          }

          .landing-footer-item {
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          /* ── How it works (below fold) ────────────────────────────── */
          .landing-flow {
            margin-top: clamp(60px, 10svh, 120px);
            max-width: 420px;
            margin-left: auto;
            margin-right: auto;
            padding: 0 24px 60px;
          }

          .landing-flow-card {
            padding: 22px 18px;
            border-radius: 24px;
            background: rgba(255, 248, 240, 0.025);
          }

          .landing-flow-title {
            margin: 0 0 18px;
            color: rgba(233, 204, 169, 0.55);
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            text-align: center;
          }

          .landing-flow-steps {
            display: grid;
            gap: 10px;
          }

          .landing-flow-steps article {
            padding: 18px;
            border-radius: 20px;
            border: 1px solid rgba(255,248,240,0.035);
            background: rgba(255, 248, 240, 0.012);
          }

          .landing-step-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
          }

          .landing-flow-steps span {
            color: rgba(226, 192, 150, 0.45);
            font-size: 10px;
            font-family: var(--font-mono);
          }

          .landing-step-icon {
            width: 28px;
            height: 28px;
            border-radius: 999px;
            display: grid;
            place-items: center;
            color: rgba(232, 202, 165, 0.55);
            border: 1px solid rgba(232, 202, 165, 0.08);
          }

          .landing-flow-steps h2 {
            margin: 0 0 4px;
            color: rgba(245, 240, 235, 0.88);
            font-size: 15px;
            font-weight: 500;
          }

          .landing-flow-steps p {
            margin: 0;
            color: rgba(245, 240, 235, 0.55);
            font-size: 13px;
            line-height: 1.45;
          }

          .landing-flow-closing {
            margin: 20px 0 0;
            color: rgba(233, 204, 169, 0.55);
            font-size: 13px;
            text-align: center;
          }

          /* ── Keyframes ────────────────────────────────────────────── */
          @keyframes orbitalFloat {
            0%, 100% { transform: translate(-50%, -50%) translateY(0); }
            50%       { transform: translate(-50%, -50%) translateY(-4px); }
          }

          @keyframes starPulse {
            0%, 100% { transform: scale(0.97); opacity: 0.75; }
            50%       { transform: scale(1.03); opacity: 1; }
          }

          /* ── Desktop ──────────────────────────────────────────────── */
          @media (min-width: 768px) {
            .landing-main {
              padding-top: max(env(safe-area-inset-top), 28px);
              padding-left: 32px;
              padding-right: 32px;
            }
            .landing-header { margin-bottom: 28px; }
            .landing-orbit-wrap { max-height: 360px; }
            .orbital-stage { width: 300px; height: 300px; }
            .orbital-ring-outer { width: 232px; height: 232px; }
            .orbital-ring-inner { width: 160px; height: 160px; }
            .orbital-core { width: 84px; height: 84px; }
            .orbital-core-mark { font-size: 28px; }
            .orbital-node-body { width: 44px; height: 44px; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: '36px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Liev
          </h1>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '4px',
              fontWeight: 400,
            }}
          >
            Una libreta tranquila para lo cotidiano
          </p>
          {pendingCount > 0 && (
            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '6px',
                opacity: 0.7,
              }}
            >
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <WeatherPill />
          <LiveClock />
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                userButtonAvatarBox: 'size-8',
              },
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: '18px' }}>
        <UniversalInput onEntryAdded={handleRefresh} weatherHint={weatherHint} />
      </div>

      <DailySummary entries={entries} />

      <div
        className="chips-scroll"
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: '6px',
          padding: '12px 20px 12px 20px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-label={chip.label}
            className={`chip${activeChip === chip.id ? ' active' : ''}`}
            onClick={() => toggleChip(chip.id)}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            {chip.id === 'calendario' && <CalendarIcon />}
            <span className={chip.id === 'calendario' ? 'chip-label-calendario' : ''}>
              {chip.label}
            </span>
          </button>
        ))}
      </div>

      {showCalendar && <MiniCalendar entries={entries} />}

      <TimelineView entries={filteredEntries} onRefresh={handleRefresh} />

      <style jsx global>{`
        .chips-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
