import type { Metadata } from 'next';
import { SlimHeader } from '@/components/sign-design/slim-header';

export const metadata: Metadata = {
  title: 'Sign Document - Nutrient Sign',
  description: 'Review and sign your document with Nutrient Sign.',
};

export default function SignTokenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <SlimHeader />
      <div className="app-content">{children}</div>
    </div>
  );
}
