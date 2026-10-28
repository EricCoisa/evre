"use server";
// Thin adapter — wraps generated role-route-access functions
import { getRoleRouteAccess } from '@/lib/generated/role-route-access/role-route-access';
import type { ApiResponse } from '@/lib/api/api';
import type { PaginationParams } from '@/lib/types/pagination.types';
import type { RoleRouteAccessControllerFindAllUserRoleParams, RoleRouteAccessControllerFindByRoleParams } from '@/lib/generated/schemas';
import type { PaginatedResponse } from '@/lib/types/pagination.types';
import type { RoleUser, RoleUserAccess } from './types';
import { normalizePaginationParams } from '../../normalize-pagination-params';
import { wrap, wrapAs } from '../../wrap';

const api = getRoleRouteAccess();

export async function getUserRoles(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<RoleUser> | RoleUser[]>> {
  return wrapAs(() => api.roleRouteAccessControllerFindAllUserRole(normalizePaginationParams<RoleRouteAccessControllerFindAllUserRoleParams>(params)));
}

export async function getUserRolesAccess(
  roleId: string,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<RoleUserAccess> | RoleUserAccess[]>> {
  return wrapAs(() => api.roleRouteAccessControllerFindByRole(roleId, normalizePaginationParams<RoleRouteAccessControllerFindByRoleParams>(params)));
}

export async function grantRoleRouteAccess(
  roleId: string,
  routeId: string,
): Promise<ApiResponse<void>> {
  return wrap(() => api.roleRouteAccessControllerCreate({ roleId, routeId }));
}

export async function revokeRoleRouteAccess(
  roleId: string,
  routeId: string,
): Promise<ApiResponse<void>> {
  return wrap(() => api.roleRouteAccessControllerRemove(roleId, routeId));
}
