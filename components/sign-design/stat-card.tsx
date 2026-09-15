import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`stat-card${accent ? ' accent' : ''}`}>
      <div className="stat-top">
        <span>{label}</span>
        {icon && <span style={{ color: accent ? 'var(--brand-accent)' : 'var(--ink-3)' }}>{icon}</span>}
      </div>
      <div className="stat-val" style={accent ? { color: 'var(--brand-accent)' } : undefined}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
