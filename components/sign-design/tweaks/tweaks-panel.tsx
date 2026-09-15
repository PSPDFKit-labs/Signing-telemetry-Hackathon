'use client';

import { useState } from 'react';
import { useTweaks } from './tweaks-context';
import type { Density, Palette, Radius, TypePairing } from './tweaks-types';

const PALETTE_OPTIONS: { value: Palette; label: string }[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
  { value: 'mono', label: 'Mono' },
  { value: 'forest', label: 'Forest' },
];

const TYPE_OPTIONS: { value: TypePairing; label: string }[] = [
  { value: 'editorial', label: 'Edit.' },
  { value: 'technical', label: 'Tech.' },
  { value: 'warm-sans', label: 'Serif' },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'spacious', label: 'Loose' },
  { value: 'balanced', label: 'Reg.' },
  { value: 'dense', label: 'Dense' },
];

const RADIUS_OPTIONS: { value: Radius; label: string }[] = [
  { value: 'sharp', label: 'Sharp' },
  { value: 'soft', label: 'Soft' },
  { value: 'round', label: 'Round' },
];

export function TweaksPanel() {
  const { tweaks, setTweak, reset } = useTweaks();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="customize-btn"
        onClick={() => setOpen((o) => !o)}
        title="Customize palette, type, density, accent"
      >
        <span className="swatch-row" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>Customize</span>
      </button>

      {open && (
        <div className="twk-panel" role="dialog" aria-label="Customize design">
          <div className="twk-hd">
            <b>Customize</b>
            <button type="button" className="twk-x" aria-label="Close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="twk-body">
            <div className="twk-sect">Theme</div>
            <Segmented
              label="Palette"
              value={tweaks.palette}
              options={PALETTE_OPTIONS}
              onChange={(v) => setTweak('palette', v)}
            />
            <Row label="Dark mode">
              <Toggle value={tweaks.dark} onChange={(v) => setTweak('dark', v)} />
            </Row>
            <Row label="Accent">
              <input
                type="color"
                className="twk-field"
                style={{ width: 48, padding: 0 }}
                value={tweaks.accent}
                onChange={(e) => setTweak('accent', e.target.value)}
              />
            </Row>

            <div className="twk-sect">Type</div>
            <Segmented
              label="Pairing"
              value={tweaks.type}
              options={TYPE_OPTIONS}
              onChange={(v) => setTweak('type', v)}
            />

            <div className="twk-sect">Layout</div>
            <Segmented
              label="Density"
              value={tweaks.density}
              options={DENSITY_OPTIONS}
              onChange={(v) => setTweak('density', v)}
            />
            <Segmented
              label="Radius"
              value={tweaks.radius}
              options={RADIUS_OPTIONS}
              onChange={(v) => setTweak('radius', v)}
            />

            <div style={{ marginTop: 8 }}>
              <button type="button" className="twk-field" style={{ cursor: 'pointer' }} onClick={reset}>
                Reset to defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="twk-row">
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      <fieldset className="twk-seg" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              background: value === opt.value ? 'rgba(255,255,255,.9)' : 'transparent',
              boxShadow: value === opt.value ? '0 1px 2px rgba(0,0,0,.12)' : 'none',
              padding: '4px 6px',
              borderRadius: 6,
            }}
          >
            {opt.label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 32,
        height: 18,
        borderRadius: 999,
        background: value ? 'rgba(56,72,107,.9)' : 'rgba(0,0,0,.18)',
        border: 0,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: 999,
          background: '#fff',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}
