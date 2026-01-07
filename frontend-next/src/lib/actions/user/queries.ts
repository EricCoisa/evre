import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, getRoles, getStatus, getUserRoutes, getUserRoutesManagement, grantUserRouteAccess, revokeUserRouteAccess, getUser } from './api';
import type { PaginationParams } from '@/lib/types/pagination.types';
import { getQueryConfig } from '@/lib/utils';
import { Alive, Collector, EmulateMutationError } from '@/lib/api/collector';
import { useApp } from '@/contexts/appProvider';

export function useUsers(params?: PaginationParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: Collector(() => getUsers(params)),
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