"use client";
import { useQuery } from '@tanstack/react-query';
import { Collector } from '@/lib/api/collector';
import { getAiHealth } from './api';
import type { AiHealthStatus } from './api';

export function useAiHealth() {
  const { data, isLoading } = useQuery<AiHealthStatus>({
    queryKey: ['ai', 'health'],
    queryFn: Collector(getAiHealth),
    staleTime: 1000 * 60 * 4, // 4 min — below backend 300s cache TTL
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  return {
    operational: data?.operational ?? false,
    reason: data?.reason,
    byokRequired: data?.byokRequired ?? false,
    userKeyConfigured: data?.userKeyConfigured ?? false,
    isLoading,
  };
}
