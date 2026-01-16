import { QueryClient } from '@tanstack/react-query';
import { QUERY_CONFIG } from '@/lib/config/performance.config';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_CONFIG.CACHE_TIMES.USERS,
      gcTime: QUERY_CONFIG.GC_TIMES.DEFAULT,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('401')) {
          return false;
        }
        return failureCount < QUERY_CONFIG.RETRY.DEFAULT_COUNT;
      },
      retryDelay: QUERY_CONFIG.RETRY.RETRY_DELAY,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});
