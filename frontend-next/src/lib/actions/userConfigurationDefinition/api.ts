"use server";
import { GET, PATCH, ApiResponse } from '../../api/api';
import { UserConfigurationsDefinitions } from './types';

export async function getUserConfigurationsDefinitions<T>(labelKey: string): Promise<ApiResponse<UserConfigurationsDefinitions<T>>> {
  return await GET<UserConfigurationsDefinitions<T>>(`/user-configuration-definitions/key/${labelKey}`);
}

export async function updateUserConfigurationsDefinitions<T>(id: string, defaultValue: T): Promise<ApiResponse<UserConfigurationsDefinitions<T>>> {
  return await PATCH<UserConfigurationsDefinitions<T>>(`/user-configuration-definitions/set/${id}`, { defaultValue });
}
