'use server';
import { headers } from 'next/headers';
import { signIn } from '@/lib/auth/auth-js';
import { isLocalDemo } from '@/lib/local-demo';

export const handleSignin = async ({ provider }: { provider: string }) => {
  try {
    if (provider === 'local-demo') {
      const host = (await headers()).get('host');
      if (!isLocalDemo() || host !== new URL(process.env.NEXT_PUBLIC_APP_URL || '').host)
        throw new Error('Local demo is unavailable');
      await signIn('local-demo', { password: process.env.LOCAL_DEMO_PASSWORD, redirectTo: '/dashboard' });
      return;
    }
    await signIn(provider, { redirectTo: '/dashboard' });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export async function signInWithEmail(email: string, callbackUrl: string) {
  try {
    // For email providers, signIn will always redirect to the verification page
    // This is normal behavior, not an error
    await signIn(process.env.EMAIL_PROVIDER, {
      email: email,
      redirectTo: callbackUrl, // Pass the callback URL properly
    });
    // This line won't be reached due to the redirect
    return { success: true };
  } catch (error: any) {
    // Check if it's a redirect (normal part of email auth flow)
    if (error?.message === 'NEXT_REDIRECT') {
      // This is the expected behavior for email sign-in
      // The redirect will be handled by Next.js
      return { success: true };
    }

    // Log and throw only for actual errors
    console.error('Authentication error:', error);
    throw new Error('Authentication failed');
  }
}
