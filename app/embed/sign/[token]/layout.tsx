import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Document - Nutrient Sign',
  description: 'Embedded document review and signing.',
};

export default function EmbeddedSignLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="app-content">{children}</div>
    </main>
  );
}
