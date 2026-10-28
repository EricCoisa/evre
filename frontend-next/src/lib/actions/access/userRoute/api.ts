"use server";
// Thin adapter — wraps generated user-route-access functions
import { getUserRouteAccess as createUserRouteAccessClient } from '@/lib/generated/user-route-access/user-route-access';
import type { ApiResponse } from '@/lib/api/api';
import type { PaginationParams } from '@/lib/types/pagination.types';
import type { UserRouteAccessControllerFindAll200, UserRouteAccessControllerFindAllParams } from '@/lib/generated/schemas';
import { normalizePaginationParams } from '../../normalize-pagination-params';
import { wrap } from '../../wrap';

const api = createUserRouteAccessClient();

export async function getUserRouteAccess(
  params?: PaginationParams,
): Promise<ApiResponse<UserRouteAccessControllerFindAll200>> {
  return wrap(() => api.userRouteAccessControllerFindAll(normalizePaginationParams<UserRouteAccessControllerFindAllParams>(params)));
}

export async function getUserRouteAccessByPath(path: string): Promise<ApiResponse<boolean>> {
  const cleanPath = path.split('?')[0].split('#')[0];
  const segments = cleanPath.split('/').filter(Boolean);
  const basePath = segments.length > 0 ? `/${segments[0]}` : '/';
  return wrap(() => api.userRouteAccessControllerCheckAccess({ path: basePath }));
}

export async function grantUserRouteAccess(
  userId: string,
  routeId: string,
): Promise<ApiResponse<void>> {
  return wrap(() => api.userRouteAccessControllerGrant({ userId, routeId }));
}

export async function revokeUserRouteAccess(
  userId: string,
  routeId: string,
): Promise<ApiResponse<void>> {
  return wrap(() => api.userRouteAccessControllerRevoke(userId, routeId));
}
