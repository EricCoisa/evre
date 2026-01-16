'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { refresh } from '@/lib/actions/auth/auth-action';
import { StateMaster } from '@/components/state-master';
import { queryClient } from '@/lib/queryClient';


export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      async function doRefresh() {
        try {
          await refresh();
        }catch (error) {
          console.error("Error during auth refresh:", error);
        }finally {  
        setLoading(false)
        }
      }
      doRefresh();
    }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <StateMaster queryKey={['auth-refresh']} isLoading={loading}>
        {children}
      </StateMaster>
    </QueryClientProvider>
  );
}
