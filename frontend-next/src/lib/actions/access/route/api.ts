
import { DELETE, GET, PATCH, POST, ApiResponse } from '@/lib/api/api';
import type { Routes, CreateRouteDto, UpdateRouteDto } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
    

export async function getRoutes(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Routes> | Routes[]>> {
  return await GET<PaginatedResponse<Routes> | Routes[]>('/route', { params });
}


export async function createRoute(data: CreateRouteDto): Promise<ApiResponse<Routes>> {
  return await POST<Routes>('/route', data);
}

export async function getHomeRoute(): Promise<ApiResponse<Routes>> {
  return await GET<Routes>(`/route/home-route`);
}

export async function getRouteByPath(path: string): Promise<ApiResponse<Routes>> {
  return await GET<Routes>(`/route/path/${path}`);
}

export async function updateRoute(id: string, data: UpdateRouteDto): Promise<ApiResponse<Routes>> {
  return await PATCH<Routes>(`/route/${id}`, data);
}



// export async function updateRoutesOrder(updates: Array<{ id: string; ordem: number }>): Promise<void> {
//   // Como não temos endpoint batch, fazemos chamadas individuais
//   await Promise.all(
//     updates.map(({ id, ordem }) => updateRoute(id, { ordem }))
//   );
// }


export async function deleteRoute(id: string): Promise<ApiResponse<void>> {
  return await DELETE<void>(`/route/${id}`);
}