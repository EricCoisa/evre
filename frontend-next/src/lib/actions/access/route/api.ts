"use server";
// Thin adapter — wraps generated route functions, preserves ApiResponse<T> shape
import { getRoute } from '@/lib/generated/route/route';
import type { ApiResponse } from '@/lib/api/api';
import type { Routes, CreateRouteDto, UpdateRouteDto } from './types';
import type { PaginationParams } from '@/lib/types/pagination.types';
import type { RouteControllerFindAll200, RouteControllerFindAllParams } from '@/lib/generated/schemas';
import { normalizePaginationParams } from '../../normalize-pagination-params';
import { wrap, wrapAs } from '../../wrap';

const api = getRoute();

export async function getRoutes(params?: PaginationParams): Promise<ApiResponse<RouteControllerFindAll200>> {
  return wrap(() => api.routeControllerFindAll(normalizePaginationParams<RouteControllerFindAllParams>(params)));
}

export async function createRoute(data: CreateRouteDto): Promise<ApiResponse<Routes>> {
  return wrap(() => api.routeControllerCreate(data) as unknown as Promise<Routes>);
}

export async function getHomeRoute(): Promise<ApiResponse<Routes>> {
  return wrap(() => api.routeControllerGetHomeRoute() as unknown as Promise<Routes>);
}

export async function getRouteByPath(path: string): Promise<ApiResponse<Routes>> {
  return wrap(() => api.routeControllerGetRouteByPath(path) as unknown as Promise<Routes>);
}

export async function updateRoute(id: string, data: UpdateRouteDto): Promise<ApiResponse<Routes>> {
  return wrap(() => api.routeControllerUpdate(id, data) as unknown as Promise<Routes>);
}

export async function deleteRoute(id: string): Promise<ApiResponse<void>> {
  return wrap(() => api.routeControllerRemove(id));
}

export async function getRoleHomes(): Promise<ApiResponse<Record<string, string>>> {
  return wrapAs(() => api.routeControllerGetRoleHomes());
}

export async function saveRoleHomes(
  homes: Record<string, string>,
): Promise<ApiResponse<Record<string, string>>> {
  return wrapAs(() => api.routeControllerSaveRoleHomes({ homes }));
}
