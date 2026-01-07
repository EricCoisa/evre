"use server";
import {  GET, PATCH, ApiResponse } from '../../api/api';
import type { SystemConfiguration } from './types';

export interface RoleOption {
  value: string;
  label: string;
}

export async function getSystemConfiguration<T>(labelKey: string): Promise<ApiResponse<SystemConfiguration<T>>> {
  return await GET<SystemConfiguration<T>>(`/system-configuration/key/${labelKey}`);
}

export async function getSignupConfiguration(): Promise<ApiResponse<SystemConfiguration<boolean>>> {
  return await GET<SystemConfiguration<boolean>>(`/system-configuration/signup`);
}

export async function getDefaultThemeConfiguration(): Promise<ApiResponse<SystemConfiguration<string>>> {
  return await GET<SystemConfiguration<string>>(`/system-configuration/default-theme`);
}

export async function updateSystemConfiguration<T>(id: string, value: T): Promise<ApiResponse<SystemConfiguration<T>>> {
  return await PATCH<SystemConfiguration<T>>(`/system-configuration/${id}`, { value });
}
