import { useQuery } from "@tanstack/react-query";
import { getClientLoggings } from "./api";
import { PaginationParams } from "../../types/pagination.types";
import { getQueryConfig } from '../../utils';
import { Collector } from "@/lib/api/collector";

export function useClientLog(params?: PaginationParams) {
  return useQuery({
    queryKey: ['clientLog', params],
    queryFn: Collector(() => getClientLoggings(params)),
    ...getQueryConfig('CLIENT_LOG'),
  });
}