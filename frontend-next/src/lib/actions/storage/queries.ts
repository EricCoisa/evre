'use client';

import { useQuery } from '@tanstack/react-query';
import { getPresignedUrl } from './api';
import { Collector } from '@/lib/api/collector';

export function usePresignedUrl(key: string | null | undefined) {
  return useQuery({
    queryKey: ['storage', 'presigned', key],
    queryFn: Collector(() => getPresignedUrl(key!)),
    enabled: !!key,
    staleTime: 1000 * 60 * 55, // 55 min (URL válida por 1h, refresh antes de expirar)
  });
}
