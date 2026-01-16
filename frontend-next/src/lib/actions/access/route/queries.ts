import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHomeRoute, getRouteByPath, getRoutes, updateRoute } from "./api";
import { PaginationParams } from "../../../types/pagination.types";
import { QUERY_CONFIG } from '../../../config/performance.config';
import type { UpdateRouteDto } from "./types";
import { Alive, Collector, EmulateMutationError } from "@/lib/api/collector";
import { useApp } from "@/contexts/appProvider";

export function useRoutes(params?: PaginationParams) {
  return useQuery({
    queryKey: ['routes', params],
    queryFn: Collector(() => {return getRoutes(params)}),
    staleTime: QUERY_CONFIG.CACHE_TIMES.ROUTES,
    gcTime: QUERY_CONFIG.GC_TIMES.ROUTES,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: QUERY_CONFIG.RETRY.DEFAULT_COUNT,
    retryDelay: QUERY_CONFIG.RETRY.RETRY_DELAY,
  });
}

export function useHome() {
  return useQuery({
    queryKey: ['route', 'home'],
    queryFn: Collector(() => getHomeRoute()),
    enabled: true,
  });
}

export function useRoute(path: string) {
  return useQuery({
    queryKey: ['route', path],
    queryFn: Collector(() => getRouteByPath(path)),
    enabled: !!path,
  });
}

export function useUpdateRoute() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRouteDto }) => {
      EmulateMutationError(emulateError, 'Emulated error from useSetUserConfiguration');
      return Alive(() => updateRoute(id, data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });
}