import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/server/auth/is-authenticated';

export const metadata: Metadata = {
  title: 'Resident Interface — Agreement Operations Demo',
  description:
    'Resident Interface proof of concept for agreement packets, bulk repapering, electronic and wet signatures, and embedded signing.',
};

export default async function HomePage() {
  headers();

  let authenticated = false;
  if (process.env.AUTH_SECRET) {
    try {
      authenticated = await isAuthenticated();
    } catch (error) {
      console.error('Authentication check failed:', error);
    }
  }

  if (authenticated) {
    redirect('/dashboard');
  }

  // Always enter the persisted workflow; never simulate a successful send.
  redirect('/login');
}
