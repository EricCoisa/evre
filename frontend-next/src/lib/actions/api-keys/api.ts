"use server";
// Thin adapter — delegates to Orval-generated client, wraps in ApiResponse for backward compat
import type { ApiResponse } from '../../api/api';
import { getApiKeys } from '@/lib/generated/api-keys/api-keys';
import type { CreateApiKeyDto, CreateApiKeyResult, ApiKey, McpScope } from './types';
import { wrapAs } from '../wrap';

const api = getApiKeys();

export async function createApiKey(dto: CreateApiKeyDto): Promise<ApiResponse<CreateApiKeyResult>> {
  return wrapAs(() => api.apiKeyControllerCreate(dto));
}

export async function listApiKeys(): Promise<ApiResponse<ApiKey[]>> {
  return wrapAs(() => api.apiKeyControllerList());
}

export async function revokeApiKey(id: string): Promise<ApiResponse<void>> {
  return wrapAs(() => api.apiKeyControllerRevoke(id));
}

export async function updateApiKeyScopes(id: string, scopes: McpScope[]): Promise<ApiResponse<void>> {
  return wrapAs(() => api.apiKeyControllerUpdateScopes(id, { scopes }));
}