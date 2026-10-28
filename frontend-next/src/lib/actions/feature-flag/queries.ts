"use client";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Collector, Alive } from '@/lib/api/collector';
import { getAllFeatureFlags, getMyFeatureFlags, createFeatureFlag, updateFeatureFlag, deleteFeatureFlag, setFeatureFlagRoles } from './api';
import type { CreateFeatureFlagDto, UpdateFeatureFlagDto, SetFeatureFlagRolesDto } from './types';

export function useMyFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags-me'],
    queryFn: Collector(() => getMyFeatureFlags()),
  });
}

export function useFeatureFlag(key: string): boolean {
  const { data } = useMyFeatureFlags();
  return data?.[key] ?? false;
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: Collector(() => getAllFeatureFlags()),
  });
}

/** Invalida as queries de feature flags e força um novo render do servidor. */
function useFeatureFlagSync() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    queryClient.invalidateQueries({ queryKey: ['feature-flags-me'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['capabilities'], refetchType: 'all' });
    router.refresh();
  };
}

export function useCreateFeatureFlag() {
  const sync = useFeatureFlagSync();
  return useMutation({
    mutationFn: (dto: CreateFeatureFlagDto) => Alive(() => createFeatureFlag(dto))(),
    onSuccess: sync,
  });
}

export function useUpdateFeatureFlag() {
  const sync = useFeatureFlagSync();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFeatureFlagDto }) =>
      Alive(() => updateFeatureFlag(id, dto))(),
    onSuccess: sync,
  });
}

export function useDeleteFeatureFlag() {
  const sync = useFeatureFlagSync();
  return useMutation({
    mutationFn: (id: string) => Alive(() => deleteFeatureFlag(id))(),
    onSuccess: sync,
  });
}

export function useSetFeatureFlagRoles() {
  const sync = useFeatureFlagSync();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: SetFeatureFlagRolesDto }) =>
      Alive(() => setFeatureFlagRoles(id, dto))(),
    onSuccess: sync,
  });
}
