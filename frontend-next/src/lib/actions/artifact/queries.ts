'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alive, Collector } from '@/lib/api/collector';
import { getQueryConfig } from '../../utils';
import type { PaginationParams } from '../../types/pagination.types';
import { archiveArtifact, getArtifacts, uploadArtifact } from './api';

export function useArtifacts(params?: PaginationParams) {
  return useQuery({
    queryKey: ['artifacts', params],
    queryFn: Collector(() => getArtifacts(params)),
    ...getQueryConfig('ARTIFACTS'),
  });
}

/** Sobe o artefato do bloco `iframe`; o chamador grava o `id` devolvido na prop do bloco. */
export function useUploadArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => Alive(() => uploadArtifact(file))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
    },
  });
}

export function useArchiveArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Alive(() => archiveArtifact(id))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
    },
  });
}
