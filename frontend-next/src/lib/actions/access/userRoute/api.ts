"use server";
import { ApiResponse, GET } from '@/lib/api/api';
import type { UserRouteAccess } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
    

export async function getUserRouteAccess(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<UserRouteAccess> | UserRouteAccess[]>> {
  return await GET<PaginatedResponse<UserRouteAccess> | UserRouteAccess[]>('/user-route-access', { params });
}

export async function getUserRouteAccessByPath(
  path: string,
): Promise<ApiResponse<boolean>> {
  // Remove query params e normaliza o path
  const cleanPath = path.split('?')[0].split('#')[0];
  // Encode path para evitar problemas com caracteres especiais
  const encodedPath = encodeURIComponent(cleanPath);
  
  const result = await GET<boolean>(`/user-route-access/checkAccess/${encodedPath}`);
  
  return result;
}