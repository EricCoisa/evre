"use server";
// Thin adapter — wraps generated functions, preserves ApiResponse<T> shape
import { getLogging } from '@/lib/generated/logging/logging';
import type { ApiResponse } from '@/lib/api/api';
import type { PaginationParams, PaginatedResponse } from '@/lib/types/pagination.types';
import type { Logging, LoggingControllerFindAllParams } from '@/lib/generated/schemas';
import { normalizePaginationParams } from '../normalize-pagination-params';
import { wrapAs } from '../wrap';

const api = getLogging();

export async function getLoggings(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<Logging> | Logging[]>> {
  return wrapAs(() => api.loggingControllerFindAll(normalizePaginationParams<LoggingControllerFindAllParams>(params)));
}
