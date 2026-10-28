import type { SaveStorageConfigDto } from '@/lib/generated/schemas';
export interface StorageProviderResponse {
  status: boolean;
  data: string;
}

export interface StorageHealthStatus {
  operational: boolean;
  reason?: string;
}

/** Corpo de `PUT /storage/config`. Segredo vazio = manter o já gravado. */
export type SaveStorageConfigPayload = SaveStorageConfigDto;
