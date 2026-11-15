import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCapabilityApi = vi.hoisted(() => ({
  capabilityControllerGetAll: vi.fn(),
}));

vi.mock('@/lib/generated/capabilities/capabilities', () => ({
  getCapabilities: () => mockCapabilityApi,
}));

import { getCapabilities } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCapabilities', () => {
  it('retorna envelope de sucesso com o mapa de capabilities', async () => {
    mockCapabilityApi.capabilityControllerGetAll.mockResolvedValue({
      STORAGE: { operational: true },
    });

    const result = await getCapabilities();

    expect(result.success).toBe(true);
    expect(mockCapabilityApi.capabilityControllerGetAll).toHaveBeenCalledOnce();
  });

  it('propaga falha como envelope de erro', async () => {
    mockCapabilityApi.capabilityControllerGetAll.mockRejectedValue(new Error('boom'));

    const result = await getCapabilities();

    expect(result.success).toBe(false);
  });
});
