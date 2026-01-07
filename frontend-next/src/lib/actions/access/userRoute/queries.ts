import { useQuery } from "@tanstack/react-query";
import { getUserRouteAccess } from "./api";
import { PaginationParams } from "../../../types/pagination.types";
import { QUERY_CONFIG } from '../../../config/performance.config';
import { Collector } from "@/lib/api/collector";

export function useUserRouteAccess(params?: PaginationParams) {
  return useQuery({
    queryKey: ['userRouteAccess', params],
    queryFn: Collector(() => {return getUserRouteAccess(params)}),
    staleTime: QUERY_CONFIG.CACHE_TIMES.USER_ROUTE_ACCESS,
    gcTime: QUERY_CONFIG.GC_TIMES.DEFAULT,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: QUERY_CONFIG.RETRY.DEFAULT_COUNT,
    retryDelay: QUERY_CONFIG.RETRY.RETRY_DELAY,
  });
}