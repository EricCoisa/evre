import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContractDocuments,
  getContractDocument,
  getContractDocumentsByProject,
  createContractDocument,
  updateContractDocumentContent,
  sendContractDocument,
  acceptContractDocument,
  archiveContractDocument,
} from './api';
import { getQueryConfig } from '@/lib/utils';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';
import type {
  CreateContractDocumentDto,
  UpdateContractDocumentContentDto,
} from './types';
import type { PaginationParams } from '@/lib/types/pagination.types';

export function useContractDocuments(params?: PaginationParams) {
  return useQuery({
    queryKey: ['contract-documents', params],
    queryFn: Collector(() => getContractDocuments(params)),
    ...getQueryConfig('CONTRACT_DOCUMENTS'),
  });
}

export function useContractDocument(id: string) {
  return useQuery({
    queryKey: ['contract-document', id],
    queryFn: Collector(() => getContractDocument(id)),
    enabled: !!id,
    ...getQueryConfig('CONTRACT_DOCUMENTS', 'CONTRACT_DOCUMENTS'),
  });
}

export function useContractDocumentsByProject(projectId: string) {
  return useQuery({
    queryKey: ['contract-documents', 'project', projectId],
    queryFn: Collector(() => getContractDocumentsByProject(projectId)),
    enabled: !!projectId,
  });
}

export function useCreateContractDocument() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (data: CreateContractDocumentDto) => {
      EmulateMutationError(
        emulateError,
        'Emulated error from useCreateContractDocument',
      );
      return Alive(() => createContractDocument(data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-documents'] });
    },
  });
}

export function useUpdateContractDocumentContent() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateContractDocumentContentDto;
    }) => {
      EmulateMutationError(
        emulateError,
        'Emulated error from useUpdateContractDocumentContent',
      );
      return Alive(() => updateContractDocumentContent(id, data))();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['contract-document', id] });
      queryClient.invalidateQueries({ queryKey: ['contract-documents'] });
    },
  });
}

export function useSendContractDocument() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(
        emulateError,
        'Emulated error from useSendContractDocument',
      );
      return Alive(() => sendContractDocument(id))();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['contract-document', id] });
      queryClient.invalidateQueries({ queryKey: ['contract-documents'] });
    },
  });
}

export function useAcceptContractDocument() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(
        emulateError,
        'Emulated error from useAcceptContractDocument',
      );
      return Alive(() => acceptContractDocument(id))();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['contract-document', id] });
      queryClient.invalidateQueries({ queryKey: ['contract-documents'] });
    },
  });
}

export function useArchiveContractDocument() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(
        emulateError,
        'Emulated error from useArchiveContractDocument',
      );
      return Alive(() => archiveContractDocument(id))();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['contract-document', id] });
      queryClient.invalidateQueries({ queryKey: ['contract-documents'] });
    },
  });
}
