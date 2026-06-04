'use client';

import type { ThemeMode } from './ThemeProvider';
import { useTheme } from './ThemeProvider';

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function ThemeSelector() {
  const { themeMode, setThemeMode } = useTheme();

  return (
    <div className="theme-selector" aria-label="Tema visual">
      {OPTIONS.map((option) => {
        const active = themeMode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className="theme-selector-option"
            aria-pressed={active}
            onClick={() => setThemeMode(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

