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
  await testLog(`[getUserRouteAccessByPath] START - path: ${path}`);
  
  try {
    // Remove query params e normaliza o path
    const cleanPath = path.split('?')[0].split('#')[0];
    await testLog(`[getUserRouteAccessByPath] Clean path: ${cleanPath}`);
    
    // Encode path para evitar problemas com caracteres especiais
    const encodedPath = encodeURIComponent(cleanPath);
    await testLog(`[getUserRouteAccessByPath] Encoded path: ${encodedPath}`);
    
    const finalUrl = `/user-route-access/checkAccess/${encodedPath}`;
    await testLog(`[getUserRouteAccessByPath] Final URL: ${finalUrl}`);
    
    await testLog(`[getUserRouteAccessByPath] Calling GET...`);
    const result = await GET<boolean>(finalUrl);
    
    await testLog(`[getUserRouteAccessByPath] GET returned - success: ${result.success}, data: ${result.data}, status: ${result.status}`);
    
    return result;
  } catch (error) {
    await testLog(`[getUserRouteAccessByPath] EXCEPTION: ${error}`);
    throw error;
  }
}

export async function testLog(msg:string): Promise<ApiResponse<void>> {
  console.log('Calling testLog with msg:', msg);
  return await GET<void>(`/route/test-log/${encodeURIComponent(msg)}`);
}