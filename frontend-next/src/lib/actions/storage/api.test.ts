import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  storageControllerSaveConfiguration: vi.fn(),
  storageControllerHealth: vi.fn(),
  storageControllerGetPresignedUrl: vi.fn(),
}));

vi.mock('@/lib/generated/storage/storage', () => ({
  getStorage: () => mockApi,
}));

import { saveStorageConfiguration, getStorageHealth, getPresignedUrl } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveStorageConfiguration', () => {
  it('valida contra o provider e salva a configuração', async () => {
    mockApi.storageControllerSaveConfiguration.mockResolvedValue({ status: true, data: 'ok' });

    const payload = { provider: 's3' } as never;
    const result = await saveStorageConfiguration(payload);

    expect(mockApi.storageControllerSaveConfiguration).toHaveBeenCalledWith(payload);
    expect(result).toMatchObject({ success: true, data: { status: true, data: 'ok' } });
  });
});

describe('getStorageHealth', () => {
  it('busca o status de saúde do provider de storage', async () => {
    mockApi.storageControllerHealth.mockResolvedValue({ operational: true });

    const result = await getStorageHealth();

    expect(mockApi.storageControllerHealth).toHaveBeenCalled();
    expect(result.data).toEqual({ operational: true });
  });
});

describe('getPresignedUrl', () => {
  it('busca a URL pré-assinada para a key informada', async () => {
    mockApi.storageControllerGetPresignedUrl.mockResolvedValue({ url: 'https://signed.example/key' });

    const result = await getPresignedUrl('some/key');

    expect(mockApi.storageControllerGetPresignedUrl).toHaveBeenCalledWith({ key: 'some/key' });
    expect(result.data).toEqual({ url: 'https://signed.example/key' });
  });
});
