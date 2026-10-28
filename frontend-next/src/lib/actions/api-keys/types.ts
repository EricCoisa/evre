// Scopes vêm do enum gerado pelo Orval; a fonte real é `McpScopes` no backend.
import { CreateApiKeyDtoScopesItem } from '@/lib/generated/schemas/createApiKeyDtoScopesItem';

export type McpScope = CreateApiKeyDtoScopesItem;
export const MCP_SCOPES: McpScope[] = Object.values(CreateApiKeyDtoScopesItem);

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: McpScope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface CreateApiKeyDto {
  name: string;
  scopes: McpScope[];
  expiresAt?: string | null;
}

export interface CreateApiKeyResult extends ApiKey {
  rawKey: string;
}
