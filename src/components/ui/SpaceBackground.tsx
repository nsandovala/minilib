'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  twinklePeriod: number;
  twinkleRange: number;
  phaseOffset: number;
  layer: 1 | 2 | 3;
  color: string;
  glowBlur?: number;
  glowColor?: string;
  parallax: number;
}

type ThemePalette = {
  bgApp: string;
  particleColor: string;
  particleOpacity: number;
  accentPrimary: string;
  accentSoft: string;
};

const FALLBACK_PALETTE: ThemePalette = {
  bgApp: '#0a0805',
  particleColor: '#fff8f0',
  particleOpacity: 0.9,
  accentPrimary: '#c9a882',
  accentSoft: 'rgba(201,168,130,0.14)',
};

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateStars(): Star[] {
  const rng = mulberry32(42);
  const stars: Star[] = [];

  // Layer 1 — distant (120)
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: rng(),
      y: rng(),
      radius: 0.5 + rng() * 0.7,
      baseOpacity: 0.15 + rng() * 0.2,
      twinklePeriod: 4 + rng() * 4,
      twinkleRange: 0.12,
      phaseOffset: rng() * Math.PI * 2,
      layer: 1,
      color: '#fff8f0',
      parallax: 0.02,
    });
  }

  // Layer 2 — mid (45)
  for (let i = 0; i < 45; i++) {
    const isSand = rng() > 0.5;
    stars.push({
      x: rng(),
      y: rng(),
      radius: 1 + rng() * 1,
      baseOpacity: 0.25 + rng() * 0.25,
      twinklePeriod: 3 + rng() * 3,
      twinkleRange: 0.18,
      phaseOffset: rng() * Math.PI * 2,
      layer: 2,
      color: isSand ? '#c9a882' : '#fff8f0',
      parallax: 0.05,
    });
  }

  // Layer 3 — foreground (15)
  for (let i = 0; i < 15; i++) {
    stars.push({
      x: rng(),
      y: rng(),
      radius: 1.5 + rng() * 1.5,
      baseOpacity: 0.4 + rng() * 0.3,
      twinklePeriod: 2 + rng() * 2,
      twinkleRange: 0.25,
      phaseOffset: rng() * Math.PI * 2,
      layer: 3,
      color: '#c9a882',
      glowBlur: 4 + rng() * 4,
      glowColor: 'rgba(201,168,130,0.4)',
      parallax: 0.1,
    });
  }

  return stars;
}

export default function SpaceBackground(): JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollYRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const dimsRef = useRef({ width: 0, height: 0, dpr: 1 });
  const paletteRef = useRef<ThemePalette>(FALLBACK_PALETTE);

  const stars = useMemo(() => generateStars(), []);
  starsRef.current = stars;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dimsRef.current.dpr = dpr;

    function readPalette() {
      const styles = getComputedStyle(document.documentElement);
      const opacity = Number.parseFloat(styles.getPropertyValue('--particle-opacity'));

      paletteRef.current = {
        bgApp: styles.getPropertyValue('--bg-app').trim() || FALLBACK_PALETTE.bgApp,
        particleColor: styles.getPropertyValue('--particle-color').trim() || FALLBACK_PALETTE.particleColor,
        particleOpacity: Number.isFinite(opacity) ? opacity : FALLBACK_PALETTE.particleOpacity,
        accentPrimary: styles.getPropertyValue('--accent-primary').trim() || FALLBACK_PALETTE.accentPrimary,
        accentSoft: styles.getPropertyValue('--accent-soft').trim() || FALLBACK_PALETTE.accentSoft,
      };
    }

    readPalette();

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      dimsRef.current.width = w;
      dimsRef.current.height = h;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize);

    const observer = new MutationObserver(readPalette);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-mode', 'style'],
    });

    function onScroll() {
      scrollYRef.current = window.scrollY;
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    let rafId = 0;

    function drawNebula1(width: number, height: number) {
      const cx = width * 0.15;
      const cy = height * 0.25;
      const r = width * 0.35;
      const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, paletteRef.current.accentSoft);
      grad.addColorStop(1, 'rgba(201,168,130,0)');
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fill();
    }

    function drawNebula2(width: number, height: number) {
      const cx = width * 0.8;
      const cy = height * 0.6;
      const r = width * 0.28;
      const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, paletteRef.current.accentSoft);
      grad.addColorStop(1, 'rgba(139,92,246,0)');
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fill();
    }

    function drawStar(star: Star, width: number, height: number, now: number) {
      const sx = star.x * width + scrollYRef.current * star.parallax;
      const sy = star.y * height + scrollYRef.current * star.parallax * 0.3;

      // Wrap horizontally to avoid empty edges on wide screens after parallax
      const wrappedX = ((sx % width) + width) % width;
      const wrappedY = ((sy % height) + height) % height;

      const twinkle =
        Math.sin(now / (star.twinklePeriod * 1000) + star.phaseOffset) *
        star.twinkleRange;
      const opacity = Math.max(
        0.02,
        Math.min(1, star.baseOpacity + twinkle)
      );

      ctx!.globalAlpha = opacity * paletteRef.current.particleOpacity;
      ctx!.fillStyle = paletteRef.current.particleColor || star.color;

      if (star.layer === 3 && star.glowBlur && star.glowColor) {
        ctx!.shadowBlur = star.glowBlur;
        ctx!.shadowColor = paletteRef.current.accentPrimary || star.glowColor;
      } else {
        ctx!.shadowBlur = 0;
        ctx!.shadowColor = 'transparent';
      }

      ctx!.beginPath();
      ctx!.arc(wrappedX, wrappedY, star.radius, 0, Math.PI * 2);
      ctx!.fill();

      // Reset shadow for next star
      ctx!.shadowBlur = 0;
      ctx!.shadowColor = 'transparent';
    }

    function frame(now: number) {
      const { width, height } = dimsRef.current;

      // 1. Base background
      ctx!.fillStyle = paletteRef.current.bgApp;
      ctx!.fillRect(0, 0, width, height);

      // 2. Nebulas (static)
      ctx!.globalAlpha = 1;
      drawNebula1(width, height);
      drawNebula2(width, height);

      // 3. Stars
      for (const star of starsRef.current) {
        drawStar(star, width, height, now);
      }

      ctx!.globalAlpha = 1;
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    />
  );
}
