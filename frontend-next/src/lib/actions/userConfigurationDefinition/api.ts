"use server";
// Thin adapter — wraps generated user-configuration-definitions functions
import { getUserConfigurationDefinitions } from '@/lib/generated/user-configuration-definitions/user-configuration-definitions';
import type { ApiResponse } from '@/lib/api/api';
import type { UserConfigurationsDefinitions } from './types';
import { wrapAs } from '../wrap';

const api = getUserConfigurationDefinitions();

export async function getUserConfigurationsDefinitions<T>(labelKey: string): Promise<ApiResponse<UserConfigurationsDefinitions<T>>> {
  return wrapAs(() => api.userConfigurationDefinitionControllerFindByLabelKey(labelKey));
}

export async function updateUserConfigurationsDefinitions<T>(id: string, defaultValue: T): Promise<ApiResponse<UserConfigurationsDefinitions<T>>> {
  return wrapAs(() => api.userConfigurationDefinitionControllerSetDefinitionDefault(id, { defaultValue: String(defaultValue) }));
}
