import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  apiKeyControllerCreate: vi.fn(),
  apiKeyControllerList: vi.fn(),
  apiKeyControllerRevoke: vi.fn(),
  apiKeyControllerUpdateScopes: vi.fn(),
}));

vi.mock('@/lib/generated/api-keys/api-keys', () => ({
  getApiKeys: () => mockApi,
}));

import { createApiKey, listApiKeys, revokeApiKey, updateApiKeyScopes } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createApiKey', () => {
  it('cria uma api key com o dto informado', async () => {
    mockApi.apiKeyControllerCreate.mockResolvedValue({ id: 'k1', rawKey: 'raw' });

    const dto = { name: 'ci', scopes: ['read' as never] };
    const result = await createApiKey(dto);

    expect(mockApi.apiKeyControllerCreate).toHaveBeenCalledWith(dto);
    expect(result).toMatchObject({ success: true, data: { id: 'k1', rawKey: 'raw' } });
  });
});

describe('listApiKeys', () => {
  it('lista as api keys do usuário', async () => {
    mockApi.apiKeyControllerList.mockResolvedValue([{ id: 'k1' }]);

    const result = await listApiKeys();

    expect(mockApi.apiKeyControllerList).toHaveBeenCalled();
    expect(result.data).toEqual([{ id: 'k1' }]);
  });
});

describe('revokeApiKey', () => {
  it('revoga uma api key por id', async () => {
    mockApi.apiKeyControllerRevoke.mockResolvedValue(undefined);

    const result = await revokeApiKey('k1');

    expect(mockApi.apiKeyControllerRevoke).toHaveBeenCalledWith('k1');
    expect(result.success).toBe(true);
  });
});

describe('updateApiKeyScopes', () => {
  it('atualiza os scopes de uma api key', async () => {
    mockApi.apiKeyControllerUpdateScopes.mockResolvedValue(undefined);

    const result = await updateApiKeyScopes('k1', ['write' as never]);

    expect(mockApi.apiKeyControllerUpdateScopes).toHaveBeenCalledWith('k1', { scopes: ['write'] });
    expect(result.success).toBe(true);
  });
});
