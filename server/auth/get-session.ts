'use server';
import { auth } from '@/lib/auth/auth-js';

export interface Session {
  user: {
    name: string;
    email: string;
    image: string;
  };
  expires: string;
}

export const getSession = async (): Promise<Session | false> => {
  const session = await auth();
  if (session?.user) {
    return session as Session;
  } else {
    return false;
  }
};
