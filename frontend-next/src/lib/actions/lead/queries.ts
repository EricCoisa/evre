import { useQuery } from '@tanstack/react-query';
import { getLeads } from './api';
import type { PaginationParams } from '@/lib/types/pagination.types';
import { getQueryConfig } from '@/lib/utils';
import { Collector } from '@/lib/api/collector';

export function useLeads(params?: PaginationParams) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: Collector(() => getLeads(params)),
    ...getQueryConfig('LEADS'),
  });
}
