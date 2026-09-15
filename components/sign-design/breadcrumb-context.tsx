'use client';

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

export type Crumb = { label: string; href?: string };

type BreadcrumbContextValue = {
  crumbs: Crumb[];
  setCrumbs: (next: Crumb[]) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const value = useMemo(() => ({ crumbs, setCrumbs }), [crumbs]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumb() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) throw new Error('useBreadcrumb must be used within <BreadcrumbProvider>');
  return ctx;
}
