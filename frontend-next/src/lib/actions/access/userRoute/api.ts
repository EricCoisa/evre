import { ApiResponse, GET } from '@/lib/api/api';
import type { UserRouteAccess } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
    

export async function getUserRouteAccess(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<UserRouteAccess> | UserRouteAccess[]>> {
  return await GET<PaginatedResponse<UserRouteAccess> | UserRouteAccess[]>('/user-route-access', { params });
}