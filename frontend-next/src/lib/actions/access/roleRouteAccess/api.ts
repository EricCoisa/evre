"use server";
import { DELETE, GET, POST, ApiResponse } from '../../../api/api';
import type { RoleUser, RoleUserAccess } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';

export async function getUserRoles(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<RoleUser> | RoleUser[]>> {
  return await GET<PaginatedResponse<RoleUser> | RoleUser[]>('/role-route-access/user-roles', {
    params,
  });
}

export async function getUserRolesAccess(
  roleId: string,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<RoleUserAccess> | RoleUserAccess[]>> {
  return await GET<PaginatedResponse<RoleUserAccess> | RoleUserAccess[]>(`/role-route-access/role/${roleId}`, {
    params,
  });
}

export async function grantRoleRouteAccess(
  roleId: string,
  routeId: string,
): Promise<ApiResponse<RoleUserAccess>> {
  return await POST<RoleUserAccess>('/role-route-access', {
    roleId,
    routeId,
  });
}

export async function revokeRoleRouteAccess(
  roleId: string,
  routeId: string,
): Promise<ApiResponse<void>> {
  return await DELETE<void>(`/role-route-access/${roleId}/${routeId}`);
}