import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Document Signed - Nutrient Sign',
  description: 'Your document has been signed successfully.',
};

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
