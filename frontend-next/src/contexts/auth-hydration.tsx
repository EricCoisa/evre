import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getProfile } from '@/lib/actions/auth/api';
import { unwrap } from '@/lib/unwrap-response';
import { getUserConfigurationByLabelKey } from '@/lib/actions/userConfiguration/api';
import { getQueryClient } from '@/lib/queryClient';
import { USER_CONFIG_KEYS } from '@/types/user-config-keys';
import { AuthProvider } from './auth-context';

/** Prefetcha sessão, idioma e tema no servidor, em paralelo, para hidratar o AuthProvider. */
export async function AuthHydration({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['me'],
      queryFn: () => unwrap(getProfile()),
    }),
    ...Object.values(USER_CONFIG_KEYS).map((labelKey) =>
      queryClient.prefetchQuery({
        queryKey: ['user-configuration', labelKey],
        queryFn: () => unwrap(getUserConfigurationByLabelKey<string>(labelKey)),
      }),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AuthProvider>{children}</AuthProvider>
    </HydrationBoundary>
  );
}
