import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserRoles, getUserRolesAccess, grantRoleRouteAccess, revokeRoleRouteAccess } from "./api";
import { PaginationParams } from "../../../types/pagination.types";
import { QUERY_CONFIG } from '../../../config/performance.config';
import { Alive, Collector, EmulateMutationError } from "@/lib/api/collector";
import { useApp } from "@/contexts/appProvider";

export function useUserRole(params?: PaginationParams) {
  return useQuery({
    queryKey: ['userRoles', params],
    queryFn: Collector(() => { return getUserRoles(params) }),
    staleTime: QUERY_CONFIG.CACHE_TIMES.ROUTES,
    gcTime: QUERY_CONFIG.GC_TIMES.ROUTES,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: QUERY_CONFIG.RETRY.DEFAULT_COUNT,
    retryDelay: QUERY_CONFIG.RETRY.RETRY_DELAY,
  });
}

export function useUserRoleAccess(routeId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: ['roleRouteAccess', routeId, params],
    queryFn: Collector(() => { return getUserRolesAccess(routeId, params) }),
    enabled: !!routeId,
    staleTime: QUERY_CONFIG.CACHE_TIMES.ROUTES,
    gcTime: QUERY_CONFIG.GC_TIMES.ROUTES,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: QUERY_CONFIG.RETRY.DEFAULT_COUNT,
    retryDelay: QUERY_CONFIG.RETRY.RETRY_DELAY,
  });
}

export function useGrantRoleRouteAccess() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();
  return useMutation({
    mutationFn: ({ roleId, routeId }: { roleId: string; routeId: string }) =>{
      EmulateMutationError(emulateError, 'Emulated error from useSetUserConfiguration');
      return Alive(() => grantRoleRouteAccess(roleId, routeId))();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roleRouteAccess', variables.roleId] });
    },
  });
}

export function useRevokeRoleRouteAccess() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: ({ roleId, routeId }: { roleId: string; routeId: string }) => {
      EmulateMutationError(emulateError, 'Emulated error from useSetUserConfiguration');
      return Alive(() => revokeRoleRouteAccess(roleId, routeId))();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roleRouteAccess', variables.roleId] });
    },
  });
}