'use client';

import { createContext, useContext, useRef } from 'react';

interface ViewerInstanceContextType {
  viewerInstanceRef: React.MutableRefObject<any>;
}

const ViewerInstanceContext = createContext<ViewerInstanceContextType | null>(null);

export function ViewerInstanceProvider({ children }: { children: React.ReactNode }) {
  const viewerInstanceRef = useRef<any>(null);

  return <ViewerInstanceContext.Provider value={{ viewerInstanceRef }}>{children}</ViewerInstanceContext.Provider>;
}

export function useViewerInstance() {
  const context = useContext(ViewerInstanceContext);
  if (!context) {
    throw new Error('useViewerInstance must be used within ViewerInstanceProvider');
  }
  return context;
}
