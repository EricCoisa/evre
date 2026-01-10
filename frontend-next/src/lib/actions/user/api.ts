"use server";
import { DELETE, GET, PATCH, POST, ApiResponse } from '../../api/api';
import type { 
  User, 
  CreateUserDto, 
  UpdateUserDto, 
  UserRouteAccess, 
  RouteWithUserAccess, 
  GrantUserRouteAccessResponse, 
  RevokeUserRouteAccessResponse, 
  UpdateProfileDto,
  UpdatePasswordDto,
  SignUpDto,
  CreateInviteDto,
  ValidateInviteResponse,
  CreateCompanyInviteDto
} from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';

export interface RoleOption {
  value: string;
  label: string;
}

export async function getUsers(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<User> | User[]>> {
  return await GET<PaginatedResponse<User> | User[]>('/user', {
    params,
  });
}

export async function signUp(data: SignUpDto): Promise<ApiResponse<User>> {
  return await POST<User>('/user/signup', data);
}

export async function getUser(id: string): Promise<ApiResponse<User>> {
  return await GET<User>(`/user/${id}`);
}

export async function createUser(data: CreateUserDto): Promise<ApiResponse<{ user: User }>> {
  return await POST<{ user: User }>('/auth/register', data);
}

export async function createInvite(data: CreateInviteDto): Promise<ApiResponse<{actionUrl: string}>> {
  return await POST<{ actionUrl: string }>('/auth/invite-token', data);
}

export async function createCompanyInvite(data: CreateCompanyInviteDto): Promise<ApiResponse<{actionUrl: string}>> {
  return await POST<{ actionUrl: string }>('/auth/invite-company-token', data);
}

export async function validateInvite(token: string): Promise<ApiResponse<ValidateInviteResponse>> {
  return await POST<ValidateInviteResponse>('/auth/validate-invite-token', { token });
}

export async function getRoles(): Promise<ApiResponse<RoleOption[]>> {
  return await GET<RoleOption[]>('/user/roles');
}

export async function getStatus(): Promise<ApiResponse<RoleOption[]>> {
  return await GET<RoleOption[]>('/user/status');
}

export async function updateUser(id: string, data: UpdateUserDto): Promise<ApiResponse<User>> {
  return await PATCH<User>(`/user/${id}`, data);
}

export async function updateProfile(id: string, data: UpdateProfileDto): Promise<ApiResponse<User>> {
  // Se há uma imagem, usa FormData para enviar multipart/form-data
  if (data.image) {
    const formData = new FormData();
    if (data.name !== undefined) formData.append('name', data.name);
    formData.append('image', data.image);
    
    return await PATCH<User>(`/user/profile/${id}`, formData);
  }
  
  // Caso contrário, envia como JSON normal
  return await PATCH<User>(`/user/profile/${id}`, data);
}

export async function updatePassword(id: string, data: UpdatePasswordDto): Promise<ApiResponse<User>> {
  return await PATCH<User>(`/user/password/${id}`, data);
}

export async function getUserRoutes(
  userId: string,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<UserRouteAccess> | UserRouteAccess[]>> {
  return await GET<PaginatedResponse<UserRouteAccess> | UserRouteAccess[]>(`/user/${userId}/routes`, {
    params,
  });
}

export async function getUserRoutesManagement(
  userId: string,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<RouteWithUserAccess> | RouteWithUserAccess[]>> {
  return await GET<PaginatedResponse<RouteWithUserAccess> | RouteWithUserAccess[]>(`/user/${userId}/routes-management`, {
    params,
  });
}

export async function grantUserRouteAccess(userId: string, routeId: string): Promise<ApiResponse<GrantUserRouteAccessResponse>> {
  return await POST<GrantUserRouteAccessResponse>('/user-route-access/grant', {
    userId,
    routeId,
  });
}

export async function revokeUserRouteAccess(userId: string, routeId: string): Promise<ApiResponse<RevokeUserRouteAccessResponse>> {
  return await DELETE<RevokeUserRouteAccessResponse>(`/user-route-access/revoke/${userId}/${routeId}`);
}