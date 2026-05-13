'use client';

import { useEffect, useState } from 'react';
import { getLocationAndWeather, fetchWeather } from '@/lib/weather';
import type { WeatherData, WeatherCondition } from '@/lib/weather';

let currentSuggestion: string | null = null;

export function useWeatherSuggestion(): string | null {
  return currentSuggestion;
}

function ConditionIcon({
  condition,
  isDay,
}: {
  condition: WeatherCondition;
  isDay: boolean;
}) {
  const s = {
    width: 14,
    height: 14,
    stroke: 'currentColor',
    strokeWidth: 1.6,
    fill: 'none',
  } as const;

  if (condition === 'clear') {
    if (isDay) {
      return (
        <svg {...s} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.5" />
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
          <line x1="4.4" y1="4.4" x2="6.2" y2="6.2" />
          <line x1="17.8" y1="17.8" x2="19.6" y2="19.6" />
          <line x1="4.4" y1="19.6" x2="6.2" y2="17.8" />
          <line x1="17.8" y1="6.2" x2="19.6" y2="4.4" />
        </svg>
      );
    }
    return (
      <svg {...s} viewBox="0 0 24 24">
        <path d="M20.5 13.5a7.5 7.5 0 1 1-10-10 9 9 0 0 0 10 10z" />
      </svg>
    );
  }

  if (condition === 'cloudy') {
    return (
      <svg {...s} viewBox="0 0 24 24">
        <path d="M18 19h1a4 4 0 0 0 0-8h-.5A5.5 5.5 0 0 0 7 11.5V12a4 4 0 0 0 0 8h11z" />
      </svg>
    );
  }

  if (condition === 'fog') {
    return (
      <svg {...s} viewBox="0 0 24 24">
        <line x1="4" y1="8" x2="20" y2="8" strokeDasharray="3 3" />
        <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="3 3" />
        <line x1="4" y1="16" x2="20" y2="16" strokeDasharray="3 3" />
      </svg>
    );
  }

  if (condition === 'drizzle') {
    return (
      <svg {...s} viewBox="0 0 24 24">
        <path d="M18 16h1a4 4 0 0 0 0-8h-.5A5.5 5.5 0 0 0 7 9.5V10a4 4 0 0 0 0 8h11z" />
        <line x1="10" y1="19" x2="10" y2="21" />
        <line x1="14" y1="19" x2="14" y2="21" />
      </svg>
    );
  }

  if (condition === 'rain') {
    return (
      <svg {...s} viewBox="0 0 24 24">
        <path d="M18 16h1a4 4 0 0 0 0-8h-.5A5.5 5.5 0 0 0 7 9.5V10a4 4 0 0 0 0 8h11z" />
        <line x1="9" y1="19" x2="9" y2="21" />
        <line x1="12" y1="19" x2="12" y2="21" />
        <line x1="15" y1="19" x2="15" y2="21" />
      </svg>
    );
  }

  if (condition === 'snow') {
    return (
      <svg {...s} viewBox="0 0 24 24">
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="5" y1="19" x2="19" y2="5" />
      </svg>
    );
  }

  if (condition === 'storm') {
    return (
      <svg {...s} viewBox="0 0 24 24">
        <path d="M18 15h1a4 4 0 0 0 0-8h-.5A5.5 5.5 0 0 0 7 8.5V9a4 4 0 0 0 0 8h11z" />
        <polyline points="13 16 11 20 15 20 13 24" />
      </svg>
    );
  }

  return (
    <svg {...s} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function conditionColor(condition: WeatherCondition, isDay: boolean): string {
  if (condition === 'clear') return isDay ? '#c9a882' : '#b09ab8';
  if (condition === 'cloudy') return 'rgba(245,240,235,0.5)';
  if (condition === 'fog') return 'rgba(245,240,235,0.4)';
  if (condition === 'drizzle' || condition === 'rain') return '#7a9e7e';
  if (condition === 'snow') return '#b09ab8';
  if (condition === 'storm') return '#c47070';
  return 'rgba(245,240,235,0.5)';
}

const LS_KEY = 'liev:weather:permission';
const VALPO_LAT = -33.0472;
const VALPO_LNG = -71.6127;

function getStoredPermission(): 'granted' | 'denied' | null {
  try {
    return localStorage.getItem(LS_KEY) as 'granted' | 'denied' | null;
  } catch {
    return null;
  }
}

function setStoredPermission(value: 'granted' | 'denied') {
  try {
    localStorage.setItem(LS_KEY, value);
  } catch {
    // silent fail in private mode
  }
}

export default function WeatherPill(): JSX.Element | null {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [permission, setPermission] = useState<'granted' | 'denied' | null>(null);

  useEffect(() => {
    setMounted(true);
    setPermission(getStoredPermission());
  }, []);

  const loadWeather = async (requestLocation = false) => {
    setLoading(true);
    let data: WeatherData | null = null;

    if (requestLocation) {
      data = await getLocationAndWeather();
      if (data) {
        setStoredPermission('granted');
        setPermission('granted');
      } else {
        setStoredPermission('denied');
        setPermission('denied');
      }
    } else if (permission === 'granted') {
      data = await getLocationAndWeather();
    }

    // Fallback a Valparaíso siempre (sin geolocation necesaria)
    if (!data) {
      try {
        data = await fetchWeather(VALPO_LAT, VALPO_LNG);
      } catch {
        // silent fail
      }
    }

    if (data) {
      setWeather(data);
      currentSuggestion = data.suggestion;
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!mounted) return;
    loadWeather(false);
    const interval = setInterval(() => loadWeather(false), 15 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, permission]);

  if (!mounted) return null;

  // Loading state: minimal dot
  if (loading) {
    return (
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'rgba(245,240,235,0.25)',
          display: 'inline-block',
        }}
      />
    );
  }

  // No weather data + no permission yet → show activate button
  if (!weather && permission !== 'granted') {
    return (
      <button
        type="button"
        onClick={() => loadWeather(true)}
        aria-label="Ver clima local"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'transparent',
          border: 'none',
          padding: '2px 6px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span>Clima</span>
      </button>
    );
  }

  if (!weather) return null;

  const color = conditionColor(weather.condition, weather.isDay);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ color, display: 'flex', alignItems: 'center' }}>
        <ConditionIcon condition={weather.condition} isDay={weather.isDay} />
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 500,
          color,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {weather.temp}°
      </span>
      {weather.precipProb >= 30 && (
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: weather.precipProb >= 70 ? '#c47070' : '#7a9e7e',
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          {weather.precipProb}%
        </span>
      )}
    </div>
  );
}
