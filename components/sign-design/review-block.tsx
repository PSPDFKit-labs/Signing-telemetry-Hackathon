import type { ReactNode } from 'react';

export function ReviewBlock({ title, onEdit, children }: { title: string; onEdit?: () => void; children: ReactNode }) {
  return (
    <div
      style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-2)', padding: 'var(--space-4) var(--space-5)' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div className="eyebrow">{title}</div>
        {onEdit && (
          <button type="button" className="btn ghost sm" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>{children}</div>
    </div>
  );
}
