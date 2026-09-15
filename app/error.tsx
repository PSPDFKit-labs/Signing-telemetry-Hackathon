'use client';

export default function ErrorPage() {
  return (
    <div
      className="empty"
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <h1
        style={{
          color: 'rgb(180, 60, 60)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 600,
          margin: 0,
          letterSpacing: '-0.01em',
        }}
      >
        Error
      </h1>
      <p style={{ color: 'var(--ink-3)', marginTop: 'var(--space-4)' }}>
        Something went wrong. Please try again later.
      </p>
    </div>
  );
}
