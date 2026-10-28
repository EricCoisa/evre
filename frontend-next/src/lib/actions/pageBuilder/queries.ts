'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Alive, Collector } from '@/lib/api/collector';
import { PAGE_LAYOUTS_KEY, type PageLayout } from '@/lib/page-builder/schema';
import {
  fetchPageSources,
  fetchSystemPageLayouts,
  savePageLayout,
  saveSystemPageLayout,
} from './api';

/** Chave única do layout padrão do sistema — usada na leitura e nas invalidações. */
export const SYSTEM_LAYOUTS_QUERY_KEY = ['page-builder-system-layouts'];

/** Fontes que este usuário alcança; consumido só pelo editor. */
export function usePageSources(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['page-builder-sources'],
    queryFn: Collector(fetchPageSources),
    enabled: options?.enabled ?? true,
    // O catálogo só muda quando alguém taguea um endpoint novo e sobe o backend.
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavePageLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageKey, layout }: { pageKey: string; layout: PageLayout }) =>
      Alive(() => savePageLayout(pageKey, layout))(),
    onSuccess: () => {
      // refetchType: 'all' porque `refetchOnMount: false` é global — sem isso a página
      // sairia do modo de edição ainda mostrando o layout anterior.
      queryClient.invalidateQueries({
        queryKey: ['user-configuration', PAGE_LAYOUTS_KEY],
        refetchType: 'all',
      });
      queryClient.invalidateQueries({ queryKey: ['user-configurations'] });
    },
  });
}

/** Layout padrão do sistema — o que vale para quem não tem layout próprio. */
export function useSystemPageLayouts() {
  return useSuspenseQuery({
    queryKey: SYSTEM_LAYOUTS_QUERY_KEY,
    queryFn: Collector(fetchSystemPageLayouts),
  });
}

/** "Salvar como Padrão" — só ADMIN; o backend recusa os demais. */
export function useSaveSystemPageLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageKey, layout }: { pageKey: string; layout: PageLayout }) =>
      Alive(() => saveSystemPageLayout(pageKey, layout))(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: SYSTEM_LAYOUTS_QUERY_KEY,
        refetchType: 'all',
      });
    },
  });
}
