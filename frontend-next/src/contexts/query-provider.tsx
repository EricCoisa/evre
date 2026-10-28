'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/queryClient';

/** Provider do QueryClient; a renovação de sessão é feita pelo middleware, não aqui. */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // `getQueryClient()` resolve o escopo por lado (ver lib/queryClient.ts): no navegador
  // devolve sempre a mesma instância, então não é preciso segurá-la em estado aqui.
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
