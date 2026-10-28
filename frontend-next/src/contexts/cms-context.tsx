'use client';

import { createContext, useContext, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface CMSContextType {
  isCMSPage: boolean;
}

const CMSContext = createContext<CMSContextType>({
  isCMSPage: false,
});

export function CMSProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isCMSPage = pathname === '/cms';
  return (
    <CMSContext.Provider value={{ isCMSPage }}>
      {children}
    </CMSContext.Provider>
  );
}

export function useCMS() {
  const context = useContext(CMSContext);
  if (!context) {
    throw new Error('useCMS must be used within CMSProvider');
  }
  return context;
}
