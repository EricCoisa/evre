"use client";
import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Collector } from '@/lib/api/collector';
import { getCapabilities } from './api';
import { CAPABILITY_FIX_PATH } from '@/types/capabilities';

export function useCapabilities() {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: Collector(getCapabilities),
    staleTime: 1000 * 60 * 4,
    refetchOnWindowFocus: false,
  });
}

/** `operational === false` desabilita; `undefined` (carregando) não desabilita. */
export function useCapability(name: string) {
  const { data } = useCapabilities();
  const status = data?.[name];
  return {
    hidden: status?.available === false,
    disabled: status?.operational === false,
    operational: status?.operational === true,
    reason: status?.reason,
    fixPath: CAPABILITY_FIX_PATH[name],
  };
}

/** Resincroniza a query informada quando o cache de `/capabilities` mudar, comparando `dataUpdatedAt`. */
export function useSyncOnCapabilitiesChange(queryKey: QueryKey): void {
  const queryClient = useQueryClient();
  const { dataUpdatedAt: capabilitiesUpdatedAt } = useCapabilities();

  useEffect(() => {
    if (capabilitiesUpdatedAt === 0) return; // /capabilities ainda não resolveu nesta sessão
    const state = queryClient.getQueryState(queryKey);
    if (state && state.dataUpdatedAt > 0 && state.dataUpdatedAt < capabilitiesUpdatedAt) {
      void queryClient.invalidateQueries({ queryKey, refetchType: 'all' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilitiesUpdatedAt]);
}
