'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { QUERY_CONFIG } from '@/lib/config/performance.config';
import { refresh } from '@/lib/actions/auth/auth-action';
import { StateMaster } from '@/components/state-master';

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

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache mais agressivo para transições rápidas
            staleTime: QUERY_CONFIG.CACHE_TIMES.USERS, // 5 minutos padrão
            gcTime: QUERY_CONFIG.GC_TIMES.DEFAULT, // 10 minutos padrão
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
            // Retry configuration
            retry: (failureCount, error) => {
              if (error instanceof Error && error.message.includes('401')) {
                return false;
              }
              return failureCount < QUERY_CONFIG.RETRY.DEFAULT_COUNT;
            },
            retryDelay: QUERY_CONFIG.RETRY.RETRY_DELAY,
            // Network mode for offline support
            networkMode: 'offlineFirst',
          },
          mutations: {
            retry: 1,
            networkMode: 'offlineFirst',
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <StateMaster queryKey={['auth-refresh']} isLoading={loading}>
        {children}
      </StateMaster>
    </QueryClientProvider>
  );
}
