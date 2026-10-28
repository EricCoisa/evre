"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApiKey, listApiKeys, revokeApiKey, updateApiKeyScopes } from './api';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';
import { getQueryConfig } from '@/lib/utils';
import type { CreateApiKeyDto, McpScope } from './types';

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: Collector(listApiKeys),
    ...getQueryConfig('USERS'),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: (dto: CreateApiKeyDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useCreateApiKey');
      return Alive(() => createApiKey(dto))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useRevokeApiKey');
      return Alive(() => revokeApiKey(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useUpdateApiKeyScopes() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: ({ id, scopes }: { id: string; scopes: McpScope[] }) => {
      EmulateMutationError(emulateError, 'Emulated error from useUpdateApiKeyScopes');
      return Alive(() => updateApiKeyScopes(id, scopes))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}