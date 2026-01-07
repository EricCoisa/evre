import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompanies, getCompany, createCompany } from './api';
import { QUERY_CONFIG } from '@/lib/config/performance.config';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';
import type { PaginationParams } from '@/lib/types/pagination.types';

export function useCompanies(params?: PaginationParams) {
  return useQuery({
    queryKey: ['companies', params],
    queryFn: Collector(() => getCompanies(params)),
    staleTime: QUERY_CONFIG.CACHE_TIMES.COMPANIES,
    gcTime: QUERY_CONFIG.GC_TIMES.COMPANIES,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: QUERY_CONFIG.RETRY.DEFAULT_COUNT,
    retryDelay: QUERY_CONFIG.RETRY.RETRY_DELAY,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: Collector(() => getCompany(id)),
    enabled: !!id,
    staleTime: QUERY_CONFIG.CACHE_TIMES.COMPANY,
    gcTime: QUERY_CONFIG.GC_TIMES.COMPANY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: QUERY_CONFIG.RETRY.DEFAULT_COUNT,
    retryDelay: QUERY_CONFIG.RETRY.RETRY_DELAY,
  });
}