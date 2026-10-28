"use client";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';
import { getQueryConfig } from '@/lib/utils';
import {
  approveAuthorization,
  getAuthorizationRequest,
  listMcpConnections,
  revokeMcpConnection,
} from './api';
import type { McpScope } from './types';

export function useMcpConnections() {
  return useQuery({
    queryKey: ['mcp-connections'],
    queryFn: Collector(listMcpConnections),
    ...getQueryConfig('USERS'),
  });
}

export function useRevokeMcpConnection() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useRevokeMcpConnection');
      return Alive(() => revokeMcpConnection(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-connections'] });
    },
  });
}

/** `req` é o pedido de autorização assinado que veio na URL do /authorize. */
export function useAuthorizationRequest(req: string | null) {
  return useQuery({
    queryKey: ['mcp-authorization-request', req],
    queryFn: Collector(() => getAuthorizationRequest(req!)),
    enabled: !!req,
    // Sem retry: o pedido expira em 10 min e tentar de novo não o ressuscita.
    retry: false,
  });
}

export function useApproveAuthorization() {
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: ({ req, scopes }: { req: string; scopes: McpScope[] }) => {
      EmulateMutationError(emulateError, 'Emulated error from useApproveAuthorization');
      return Alive(() => approveAuthorization(req, scopes))();
    },
  });
}
