"use client";

import { useQuery } from '@tanstack/react-query';
import { getQueryConfig } from '@/lib/utils';
import { Collector } from '@/lib/api/collector';
import { getProfile } from './api';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: Collector(() => {return getProfile()}),
    ...getQueryConfig('ME'),
  });
}
