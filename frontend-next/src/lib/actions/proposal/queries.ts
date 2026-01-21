import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getProposals, 
  getProposal, 
  getPublicProposal,
  getProposalsByCompany,
  createProposal, 
  updateProposalContent,
  sendProposal,
  approveProposal,
  updateProposalProject,
  getProposalByProject,
  deleteProposal
} from './api';
import { getQueryConfig } from '@/lib/utils';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';
import type { PaginationParams } from '@/lib/types/pagination.types';
import type { CreateProposalDto, UpdateProposalContentDto, UpdateProposalProjectDto } from './types';

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
    ...getQueryConfig('PROPOSALS', 'PROPOSALS'),
  });
}

export function useProposalProject(projectId: string) {
  return useQuery({
    queryKey: ['proposal', projectId],
    queryFn: Collector(() => getProposalByProject(projectId)),
    enabled: !!projectId,
    ...getQueryConfig('PROPOSALS', 'PROPOSALS'),
  });
}

export function usePublicProposal(id: string) {
  return useQuery({
    queryKey: ['proposal', 'public', id],
    queryFn: Collector(() => getPublicProposal(id)),
    enabled: !!id,
  });
}

export function useProposalsByCompany(companyId: string) {
  return useQuery({
    queryKey: ['proposals', 'company', companyId],
    queryFn: Collector(() => getProposalsByCompany(companyId)),
    enabled: !!companyId,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  
  return useMutation({
    mutationFn: (data: CreateProposalDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useCreateProposal');
      return Alive(() => createProposal(data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useUpdateProposalContent() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalContentDto }) => {
      EmulateMutationError(emulateError, 'Emulated error from useUpdateProposalContent');
      return Alive(() => updateProposalContent(id, data))();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useUpdateProposalProject() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalProjectDto }) => {
      EmulateMutationError(emulateError, 'Emulated error from useUpdateProposalProject');
      return Alive(() => updateProposalProject(id, data))();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}




export function useSendProposal() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  
  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useSendProposal');
      return Alive(() => sendProposal(id))();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useApproveProposal() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  
  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useApproveProposal');
      return Alive(() => approveProposal(id))();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', id] });
      queryClient.invalidateQueries({ queryKey: ['proposal', 'public', id] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useDeleteProposal() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  
  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useDeleteProposal');
      return Alive(() => deleteProposal(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}
