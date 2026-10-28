"use client";
import { useQuery, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Collector, Alive } from '@/lib/api/collector';
import {
  listConversations,
  createConversation,
  deleteConversation,
  getAiModels,
  listCandidateAiModels,
  getAiTools,
  getAiToolPermissions,
  revokeAiToolAccess,
  allowAiToolAccess,
} from './api';

const AI_TOOL_PERMISSIONS_KEY = ['ai', 'tools', 'permissions'] as const;

const AI_CONVERSATIONS_KEY = ['ai', 'conversations'] as const;

export function useAiConversationList() {
  return useQuery({
    queryKey: AI_CONVERSATIONS_KEY,
    queryFn: Collector(() => listConversations()),
  });
}

export function useAiModels() {
  return useQuery({
    queryKey: ['ai', 'models'],
    queryFn: Collector(() => getAiModels()),
    staleTime: 1000 * 30,
  });
}

/** Modelos reais de um provider ainda não salvo — popula o select do dialog de /settings. */
export function useCandidateAiModels(provider: string | null) {
  return useQuery({
    queryKey: ['ai', 'models', 'candidate', provider],
    queryFn: Collector(() => listCandidateAiModels({ provider: provider! })),
    enabled: !!provider,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { title?: string }) => Alive(() => createConversation(dto))(),
    onSuccess: () => qc.invalidateQueries({ queryKey: AI_CONVERSATIONS_KEY }),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Alive(() => deleteConversation(id))(),
    onSuccess: () => qc.invalidateQueries({ queryKey: AI_CONVERSATIONS_KEY }),
  });
}

export function useAiTools() {
  return useQuery({
    queryKey: ['ai', 'tools'],
    queryFn: Collector(() => getAiTools()),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

export function useAiToolPermissions() {
  return useSuspenseQuery({
    queryKey: AI_TOOL_PERMISSIONS_KEY,
    queryFn: Collector(() => getAiToolPermissions()),
  });
}

export function useRevokeAiToolAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => Alive(() => revokeAiToolAccess(name))(),
    onSuccess: () => qc.invalidateQueries({ queryKey: AI_TOOL_PERMISSIONS_KEY }),
  });
}

export function useAllowAiToolAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => Alive(() => allowAiToolAccess(name))(),
    onSuccess: () => qc.invalidateQueries({ queryKey: AI_TOOL_PERMISSIONS_KEY }),
  });
}
