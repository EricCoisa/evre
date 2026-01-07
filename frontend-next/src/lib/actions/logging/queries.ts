import { useQuery } from "@tanstack/react-query";
import { getLoggings } from "./api";
import { PaginationParams } from "../../types/pagination.types";
import { getQueryConfig } from '../../utils';
import { Collector } from "@/lib/api/collector";

export function useLogging(params?: PaginationParams) {
  return useQuery({
    queryKey: ['logging', params],
    queryFn: Collector(() => getLoggings(params)),
    ...getQueryConfig('LOGGING'),
  });
}