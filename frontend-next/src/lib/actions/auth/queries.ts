"use client";

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getQueryConfig } from '@/lib/utils';
import { Collector } from '@/lib/api/collector';
import { getProfile, getOAuthProviders } from './api';

export function useMe() {
  return useSuspenseQuery({
    queryKey: ['me'],
    queryFn: Collector(() => {return getProfile()}),
    ...getQueryConfig('ME'),
  });
}

/** Lista de providers OAuth vinda do backend — inclui os ainda não configurados. */
export function useOAuthProviders() {
  return useQuery({
    queryKey: ['oauth-providers'],
    queryFn: Collector(() => getOAuthProviders()),
  });
}
