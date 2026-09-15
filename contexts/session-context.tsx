'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import type { Session } from '@/server/auth/get-session';

const SessionContext = createContext<{
  session: Session | null;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
}>({
  session: null,
  setSession: () => null,
});

export const SessionProvider = ({
  children,
  session: initialSession,
}: {
  children: ReactNode;
  session: Session | null;
}) => {
  const [session, setSession] = useState<Session | null>(initialSession);

  return <SessionContext.Provider value={{ session, setSession }}>{children}</SessionContext.Provider>;
};

export const useSession = () => useContext(SessionContext);
