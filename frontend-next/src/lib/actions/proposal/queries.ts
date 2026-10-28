'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alive, Collector } from '@/lib/api/collector';
import { getQueryConfig } from '../../utils';
import type { PaginationParams } from '../../types/pagination.types';
import {
  acceptProposalOffline,
  archiveProposal,
  createProposal,
  duplicateProposal,
  getProposal,
  getProposals,
  listProposalSends,
  listProposalVersions,
  publishProposal,
  revokeProposalPublication,
  sendProposal,
  updateProposal,
  updateProposalLayout,
  updateProposalStatus,
  updateProposalTerms,
  uploadProposalArtifact,
} from './api';
import type {
  AcceptProposalOfflineDto,
  CreateProposalDto,
  SendProposalDto,
  UpdateProposalDto,
  UpdateProposalLayoutDto,
  UpdateProposalStatusDto,
  UpdateProposalTermsDto,
} from './types';

export function useProposals(params?: PaginationParams) {
  return useQuery({
    queryKey: ['proposals', params],
    queryFn: Collector(() => getProposals(params)),
    ...getQueryConfig('PROPOSAL'),
  });
}

export function useProposal(id: string) {
  return useQuery({
    queryKey: ['proposal', id],
    queryFn: Collector(() => getProposal(id)),
    enabled: !!id,
    ...getQueryConfig('PROPOSAL'),
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProposalDto) => Alive(() => createProposal(data))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalDto }) =>
      Alive(() => updateProposal(id, data))(),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id] });
    },
  });
}

/** "Excluir" uma proposta arquiva no servidor — nada é apagado. */
export function useArchiveProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Alive(() => archiveProposal(id))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposal archived successfully');
    },
  });
}

/** Alavanca "não comece do zero" — cópia nasce DRAFT, sem versão nem token. */
export function useDuplicateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Alive(() => duplicateProposal(id))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useUpdateProposalLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalLayoutDto }) =>
      Alive(() => updateProposalLayout(id, data))(),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id] });
    },
  });
}

export function useUpdateProposalTerms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalTermsDto }) =>
      Alive(() => updateProposalTerms(id, data))(),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id] });
    },
  });
}

export function useUpdateProposalStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalStatusDto }) =>
      Alive(() => updateProposalStatus(id, data))(),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id] });
    },
  });
}

export function useProposalVersions(id: string) {
  return useQuery({
    queryKey: ['proposal', id, 'versions'],
    queryFn: Collector(() => listProposalVersions(id)),
    enabled: !!id,
    ...getQueryConfig('PROPOSAL'),
  });
}

/** Publicar deriva o token novo e revoga o anterior no servidor — por isso invalida tanto a
 * proposta (status pode virar SENT) quanto a lista de versões. */
export function usePublishProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Alive(() => publishProposal(id))(),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['proposal', id, 'versions'] });
    },
  });
}

/** Idempotente no servidor — revogar duas vezes não lança, só devolve `alreadyRevoked: true`. */
export function useRevokeProposalPublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Alive(() => revokeProposalPublication(id))(),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', id, 'versions'] });
    },
  });
}

/** Idempotente no servidor — registrar o mesmo aceite duas vezes não cria uma segunda decisão. */
export function useAcceptProposalOffline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AcceptProposalOfflineDto }) =>
      Alive(() => acceptProposalOffline(id, data))(),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id, 'versions'] });
    },
  });
}

/** Canal indisponível não lança — `succeeded: false` chega aqui como resultado normal, não erro. */
export function useSendProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SendProposalDto }) =>
      Alive(() => sendProposal(id, data))(),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id, 'sends'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id, 'versions'] });
    },
  });
}

export function useProposalSends(id: string) {
  return useQuery({
    queryKey: ['proposal', id, 'sends'],
    queryFn: Collector(() => listProposalSends(id)),
    enabled: !!id,
    ...getQueryConfig('PROPOSAL'),
  });
}

/** Sobe o artefato do bloco `iframe`; o chamador grava a `storageKey` devolvida na prop do bloco. */
export function useUploadProposalArtifact() {
  return useMutation({
    mutationFn: ({ proposalId, file }: { proposalId: string; file: File }) =>
      Alive(() => uploadProposalArtifact(proposalId, file))(),
  });
}
