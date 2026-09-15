'use server';
import { signOut } from '@/lib/auth/auth-js';

export const handleSignOut = async () => {
  await signOut();
};
