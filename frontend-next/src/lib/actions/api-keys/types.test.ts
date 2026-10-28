import { describe, it, expect } from 'vitest';
import { MCP_SCOPES } from './types';
import { CreateApiKeyDtoScopesItem } from '@/lib/generated/schemas/createApiKeyDtoScopesItem';

describe('MCP_SCOPES', () => {
  it('derives its list from every value of the generated scopes enum', () => {
    expect(MCP_SCOPES).toEqual(Object.values(CreateApiKeyDtoScopesItem));
    expect(MCP_SCOPES.length).toBeGreaterThan(0);
  });
});
