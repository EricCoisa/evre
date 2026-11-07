"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers, getRoles, getStatus, getUserRoutes, getUserRoutesManagement, getUser, deleteUser, getInvites, deleteInvite,
} from './api';
import { grantUserRouteAccess, revokeUserRouteAccess } from '@/lib/actions/access/userRoute/api';
import { getStorageHealth } from '@/lib/actions/storage/api';
import type { PaginationParams } from '@/lib/types/pagination.types';
import { getQueryConfig } from '@/lib/utils';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';

export function useUsers(params?: PaginationParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: Collector(() => getUsers(params)),
    enabled: options?.enabled ?? true,
    ...getQueryConfig('USERS'),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: Collector(() => getUser(id)),
    ...getQueryConfig('USER', 'USER'),
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['users', 'roles'],
    queryFn: Collector(getRoles),
    staleTime: 1000 * 60 * 60, // 1 hora - roles não mudam frequentemente
  });
}

export function useUserStatus() {
  return useQuery({
    queryKey: ['users', 'status'],
    queryFn: Collector(getStatus),
    staleTime: 1000 * 60 * 60, // 1 hora - roles não mudam frequentemente
  });
}


export function useUserRoutes(userId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: ['users', userId, 'routes', params],
    queryFn: Collector(() => getUserRoutes(userId, params)),
    enabled: !!userId,
  });
}

export function useUserRoutesManagement(userId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: ['users', userId, 'routes-management', params],
    queryFn: Collector(() => getUserRoutesManagement(userId, params)),
    enabled: !!userId,
    staleTime: 0,          // sempre stale — modal deve ver estado atual
    refetchOnMount: true,  // refetch toda vez que o modal abre
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useDeleteUser');
      return Alive(() => deleteUser(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useGrantUserRouteAccess() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: ({ userId, routeId }: { userId: string; routeId: string }) => {
      EmulateMutationError(emulateError, 'Emulated error from useSetUserConfiguration');
      return Alive(() => grantUserRouteAccess(userId, routeId))();
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'routes-management'] });
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'routes'] });
    },
  });
}

export function useInvites() {
  return useQuery({
    queryKey: ['invites'],
    queryFn: Collector(getInvites),
    staleTime: 1000 * 30,
  });
}

export function useStorageHealth() {
  return useQuery({
    queryKey: ['storage', 'health'],
    queryFn: Collector(getStorageHealth),
    staleTime: 1000 * 60 * 4, // 4 min — abaixo do TTL 300s do cache backend
    refetchOnWindowFocus: false,
  });
}

export function useDeleteInvite() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useDeleteInvite');
      return Alive(() => deleteInvite(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
}

export function useRevokeUserRouteAccess() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: ({ userId, routeId }: { userId: string; routeId: string }) => {
      EmulateMutationError(emulateError, 'Emulated error from useSetUserConfiguration');
      return Alive(() => revokeUserRouteAccess(userId, routeId))();
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'routes-management'] });
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'routes'] });
    },
  });
}
