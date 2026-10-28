"use server";
import type { ApiResponse } from '../../api/api';
import { getStorage } from '@/lib/generated/storage/storage';
import type { StorageProviderResponse, StorageHealthStatus, SaveStorageConfigPayload } from './types';
import { wrapAs } from '../wrap';

const api = getStorage();

/** Valida contra o provider e salva num passo só — ver saveEmailConfiguration. */
export async function saveStorageConfiguration(
  payload: SaveStorageConfigPayload,
): Promise<ApiResponse<StorageProviderResponse>> {
  return wrapAs(() => api.storageControllerSaveConfiguration(payload));
}

export async function getStorageHealth(): Promise<ApiResponse<StorageHealthStatus>> {
  return wrapAs(() => api.storageControllerHealth());
}

export async function getPresignedUrl(key: string): Promise<ApiResponse<{ url: string }>> {
  return wrapAs(() => api.storageControllerGetPresignedUrl({ key }));
}
