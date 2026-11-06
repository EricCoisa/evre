'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alive, Collector } from '@/lib/api/collector';
import { getQueryConfig } from '../../utils';
import type { PaginationParams } from '../../types/pagination.types';
import { archiveArtifact, deleteArtifactPermanently, getArtifactPreviewUrl, getArtifacts, publishArtifact, uploadArtifact } from './api';

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
    mutationFn: ({ file, name }: { file: File; name: string }) =>
      Alive(() => uploadArtifact(file, name))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
    },
  });
}

export function useArtifactPreviewUrl(id: string | null | undefined) {
  return useQuery({
    queryKey: ['artifact-preview', id],
    queryFn: Collector(() => getArtifactPreviewUrl(id!)),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePublishArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPublic = false }: { id: string; isPublic?: boolean }) =>
      Alive(() => publishArtifact(id, isPublic))(),
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

export function useDeleteArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Alive(() => deleteArtifactPermanently(id))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
    },
  });
}
