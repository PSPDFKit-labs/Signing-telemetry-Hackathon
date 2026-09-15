'use client';

import Link from 'next/link';
import { IconMoon, IconSun } from './icons';
import { useTweaks } from './tweaks/tweaks-context';
import { TweaksPanel } from './tweaks/tweaks-panel';

export function SlimHeader() {
  const { tweaks, setTweak } = useTweaks();
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px var(--space-5)',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg)',
      }}
    >
      <Link href="/" className="wordmark">
        <span className="dot" />
        Nutrient Sign
      </Link>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <TweaksPanel />
        <button
          type="button"
          className="theme-toggle"
          aria-label="Toggle theme"
          onClick={() => setTweak('dark', !tweaks.dark)}
        >
          {tweaks.dark ? <IconSun /> : <IconMoon />}
        </button>
      </div>
    </header>
  );
}
