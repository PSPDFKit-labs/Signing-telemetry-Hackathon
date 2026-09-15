'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TWEAK_DEFAULTS, TWEAK_STORAGE_KEY, type Tweaks } from './tweaks-types';

type TweaksContextValue = {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  reset: () => void;
};

const TweaksContext = createContext<TweaksContextValue | null>(null);

function applyToDom(tweaks: Tweaks) {
  if (typeof document === 'undefined') return;
  const theme = tweaks.dark ? 'dark' : 'light';
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  html.setAttribute('data-palette', tweaks.palette);
  html.setAttribute('data-type', tweaks.type);
  html.setAttribute('data-density', tweaks.density);
  html.setAttribute('data-radius', tweaks.radius);
  // The mockup pins the accent at the user-picked color (default #38486B)
  // in BOTH light and dark mode by inline-overriding the palette CSS values.
  // Match that behavior so the design reads consistently regardless of palette.
  html.style.setProperty('--brand-accent', tweaks.accent);
  html.style.setProperty('--brand-accent-2', `color-mix(in srgb, ${tweaks.accent} 70%, white)`);
  html.style.setProperty('--brand-accent-tint', `color-mix(in srgb, ${tweaks.accent} 12%, transparent)`);
  // Keep shadcn's body-level data-theme + ZeroUI's theme-preference in sync
  // so existing primitives (Card, etc.) follow the same light/dark choice.
  if (document.body) {
    document.body.setAttribute('data-theme', theme);
  }
  try {
    window.localStorage.setItem('theme-preference', theme);
  } catch {}
}

function readStored(): Tweaks {
  if (typeof window === 'undefined') return TWEAK_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(TWEAK_STORAGE_KEY);
    if (!raw) return TWEAK_DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...TWEAK_DEFAULTS, ...parsed };
  } catch {
    return TWEAK_DEFAULTS;
  }
}

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(TWEAK_DEFAULTS);

  useEffect(() => {
    const stored = readStored();
    setTweaks(stored);
    applyToDom(stored);
  }, []);

  const setTweak = useCallback(<K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
    setTweaks((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(TWEAK_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      applyToDom(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(TWEAK_STORAGE_KEY);
    } catch {}
    setTweaks(TWEAK_DEFAULTS);
    applyToDom(TWEAK_DEFAULTS);
  }, []);

  const value = useMemo(() => ({ tweaks, setTweak, reset }), [tweaks, setTweak, reset]);

  return <TweaksContext.Provider value={value}>{children}</TweaksContext.Provider>;
}

export function useTweaks() {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error('useTweaks must be used within <TweaksProvider>');
  return ctx;
}
