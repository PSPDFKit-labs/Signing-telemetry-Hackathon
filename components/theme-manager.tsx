'use client';

import { useUI } from '@react-zero-ui/core';
import { useEffect } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('theme-preference') as ThemePreference) || 'system';
}

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  return preference === 'system' ? getSystemTheme() : preference;
}

export default function ThemeManager() {
  const [, setTheme] = useUI<'light' | 'dark'>('theme', 'light');

  useEffect(() => {
    const preference = getSavedPreference();
    setTheme(resolveTheme(preference));

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = getSavedPreference();
      if (current === 'system') {
        setTheme(getSystemTheme());
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setTheme]);

  return null;
}

export function setThemePreference(preference: ThemePreference) {
  localStorage.setItem('theme-preference', preference);
  const resolved = resolveTheme(preference);
  document.body.setAttribute('data-theme', resolved);
}

export function cycleThemePreference(): ThemePreference {
  const current = getSavedPreference();
  const next: ThemePreference = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
  setThemePreference(next);
  return next;
}
