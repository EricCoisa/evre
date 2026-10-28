"use server";
// Thin adapter — wraps generated user-configuration functions
import { getUserConfiguration as createUserConfigClient } from '@/lib/generated/user-configuration/user-configuration';
import type { ApiResponse } from '@/lib/api/api';
import type { UserConfiguration } from './types';
import { wrap, wrapAs } from '../wrap';

const api = createUserConfigClient();

export async function getUserConfigurations(): Promise<ApiResponse<UserConfiguration[]>> {
  return wrap(() => api.userConfigurationControllerGetUserConfigurations() as Promise<UserConfiguration[]>);
}

export async function getUserConfigurationByLabelKey<T>(labelKey: string): Promise<ApiResponse<UserConfiguration<T> | null>> {
  return wrapAs(() => api.userConfigurationControllerGetUserConfigurationsKey(labelKey));
}

export async function setUserConfiguration<T>(
  definitionId: string,
  value: T
): Promise<ApiResponse<UserConfiguration<T>>> {
  return wrapAs(() =>
    api.userConfigurationControllerSetUserConfiguration({ definitionId, value: String(value) })
  );
}

export async function resetUserConfiguration(definitionId: string): Promise<ApiResponse<void>> {
  return wrap(() => api.userConfigurationControllerResetUserConfiguration(definitionId));
}
