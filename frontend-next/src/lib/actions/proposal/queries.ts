'use client';

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/use-translation';
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
  reopenProposal,
  revokeProposalPublication,
  sendProposal,
  updateProposal,
  updateProposalLayout,
  updateProposalStatus,
  updateProposalTerms,
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
    ...getQueryConfig('PROPOSALS'),
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

/** Invalida as chaves passadas (`refetchType: 'all'`: a lista afetada costuma estar desmontada e o
 * `refetchOnMount: false` global não a recarregaria) e força um novo render do servidor —
 * `proposal/[id]` é Server Component e passa o registro como prop estática, então
 * `invalidateQueries` sozinho é no-op sobre o que a página já renderizou. */
function useProposalSync() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return (keys: QueryKey[]) => {
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key, refetchType: 'all' }));
    router.refresh();
  };
}

/** Cria a proposta e, com `companyId`, a vincula à empresa antes de invalidar. */
export function useCreateProposal() {
  const sync = useProposalSync();
  return useMutation({
    mutationFn: async ({ companyId, ...data }: CreateProposalDto & { companyId?: string }) => {
      const proposal = await Alive(() => createProposal(data))();
      if (companyId) {
        await Alive(() => updateProposal(proposal.id, { companyId }))().catch(() => undefined);
      }
      return proposal;
    },
    onSuccess: () => {
      sync([['proposals'], ['companies']]);
    },
  });
}

export function useUpdateProposal() {
  const sync = useProposalSync();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalDto }) =>
      Alive(() => updateProposal(id, data))(),
    onSuccess: (_, variables) => {
      sync([['proposals'], ['proposal', variables.id]]);
    },
  });
}

/** "Excluir" uma proposta arquiva no servidor — nada é apagado. */
export function useArchiveProposal() {
  const sync = useProposalSync();
  const { t } = useTranslation('proposal');
  return useMutation({
    mutationFn: (id: string) => Alive(() => archiveProposal(id))(),
    onSuccess: () => {
      sync([['proposals']]);
      toast.success(t('archivedSuccess'));
    },
  });
}

/** Alavanca "não comece do zero" — cópia nasce DRAFT, sem versão nem token. */
export function useDuplicateProposal() {
  const sync = useProposalSync();
  return useMutation({
    mutationFn: (id: string) => Alive(() => duplicateProposal(id))(),
    onSuccess: () => {
      sync([['proposals']]);
    },
  });
}

export function useUpdateProposalLayout() {
  const sync = useProposalSync();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalLayoutDto }) =>
      Alive(() => updateProposalLayout(id, data))(),
    onSuccess: (_, variables) => {
      sync([['proposal', variables.id]]);
    },
  });
}

export function useUpdateProposalTerms() {
  const sync = useProposalSync();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalTermsDto }) =>
      Alive(() => updateProposalTerms(id, data))(),
    onSuccess: (_, variables) => {
      sync([['proposal', variables.id]]);
    },
  });
}

export function useUpdateProposalStatus() {
  const sync = useProposalSync();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalStatusDto }) =>
      Alive(() => updateProposalStatus(id, data))(),
    onSuccess: (_, variables) => {
      sync([['proposals'], ['proposal', variables.id]]);
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
  const sync = useProposalSync();
  return useMutation({
    mutationFn: (id: string) => Alive(() => publishProposal(id))(),
    onSuccess: (_, id) => {
      sync([['proposal', id], ['proposal', id, 'versions']]);
    },
  });
}

/** Devolve a proposta para DRAFT de qualquer status; revoga a versão pública vigente. */
export function useReopenProposal() {
  const sync = useProposalSync();
  return useMutation({
    mutationFn: (id: string) => Alive(() => reopenProposal(id))(),
    onSuccess: (_, id) => {
      sync([['proposals'], ['proposal', id], ['proposal', id, 'versions']]);
    },
  });
}

/** Idempotente no servidor — revogar duas vezes não lança, só devolve `alreadyRevoked: true`. */
export function useRevokeProposalPublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Alive(() => revokeProposalPublication(id))(),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['proposal', id, 'versions'] });
    },
  });
}

/** Idempotente no servidor — registrar o mesmo aceite duas vezes não cria uma segunda decisão. */
export function useAcceptProposalOffline() {
  const sync = useProposalSync();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AcceptProposalOfflineDto }) =>
      Alive(() => acceptProposalOffline(id, data))(),
    onSuccess: (_, variables) => {
      sync([['proposal', variables.id], ['proposal', variables.id, 'versions']]);
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
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id] });
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
