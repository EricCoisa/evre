import { useQuery } from '@tanstack/react-query';
import {
  getContacts
} from './api';
import { getQueryConfig } from '@/lib/utils';
import { Collector } from '@/lib/api/collector';
import type { PaginationParams } from '@/lib/types/pagination.types';

export function useContacts(params?: PaginationParams) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn: Collector(() => getContacts(params)),
    ...getQueryConfig('CONTACTS'),
  });
}
