import type { ReactNode } from 'react';

export function Alert({
  variant = 'info',
  title,
  children,
}: {
  variant?: 'warn' | 'info';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`alert ${variant}`} role={variant === 'warn' ? 'alert' : 'status'} aria-live="polite">
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}
