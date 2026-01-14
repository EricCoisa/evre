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
  try {
    // Remove query params e normaliza o path
    const cleanPath = path.split('?')[0].split('#')[0];
    
    // Extrai apenas o segmento base da rota (remove parâmetros dinâmicos)
    // Ex: /home/uuid -> /home, /projects/123/edit -> /projects
    const segments = cleanPath.split('/').filter(Boolean);
    const basePath = segments.length > 0 ? `/${segments[0]}` : '/';
    
    // Remove a barra inicial se existir, para evitar problemas com %2F no Linux
    const pathWithoutLeadingSlash = basePath.startsWith('/') ? basePath.substring(1) : basePath;

    // Encode path para evitar problemas com caracteres especiais
    const encodedPath = encodeURIComponent(pathWithoutLeadingSlash);

    const finalUrl = `/user-route-access/checkAccess/${encodedPath}`;
    const result = await GET<boolean>(finalUrl);
  
    return result;
  } catch (error) {
    throw error;
  }
}