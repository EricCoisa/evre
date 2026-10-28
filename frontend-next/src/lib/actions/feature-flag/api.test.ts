import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  featureFlagControllerGetForMe: vi.fn(),
  featureFlagControllerFindAll: vi.fn(),
  featureFlagControllerCreate: vi.fn(),
  featureFlagControllerUpdate: vi.fn(),
  featureFlagControllerRemove: vi.fn(),
  featureFlagControllerSetRoles: vi.fn(),
}));

vi.mock('@/lib/generated/feature-flags/feature-flags', () => ({
  getFeatureFlags: () => mockApi,
}));

import {
  getMyFeatureFlags,
  getAllFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  setFeatureFlagRoles,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMyFeatureFlags', () => {
  it('devolve o mapa de flags do usuário logado', async () => {
    mockApi.featureFlagControllerGetForMe.mockResolvedValue({ beta: true });

    const result = await getMyFeatureFlags();

    expect(result).toMatchObject({ success: true, data: { beta: true } });
  });
});

describe('getAllFeatureFlags', () => {
  it('devolve a lista completa de flags', async () => {
    mockApi.featureFlagControllerFindAll.mockResolvedValue([{ id: 'f1', key: 'beta' }]);

    const result = await getAllFeatureFlags();

    expect(result).toMatchObject({ success: true, data: [{ id: 'f1', key: 'beta' }] });
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.featureFlagControllerFindAll.mockRejectedValue(new Error('boom'));

    const result = await getAllFeatureFlags();

    expect(result.success).toBe(false);
  });
});

describe('createFeatureFlag', () => {
  it('cria a flag repassando o dto', async () => {
    mockApi.featureFlagControllerCreate.mockResolvedValue({ id: 'f1', key: 'beta' });

    const result = await createFeatureFlag({ key: 'beta' } as never);

    expect(mockApi.featureFlagControllerCreate).toHaveBeenCalledWith({ key: 'beta' });
    expect(result.success).toBe(true);
  });
});

describe('updateFeatureFlag', () => {
  it('atualiza a flag por id repassando o dto', async () => {
    mockApi.featureFlagControllerUpdate.mockResolvedValue({ id: 'f1', key: 'beta' });

    const result = await updateFeatureFlag('f1', { enabled: true } as never);

    expect(mockApi.featureFlagControllerUpdate).toHaveBeenCalledWith('f1', { enabled: true });
    expect(result.success).toBe(true);
  });
});

describe('deleteFeatureFlag', () => {
  it('remove a flag por id', async () => {
    mockApi.featureFlagControllerRemove.mockResolvedValue(undefined);

    const result = await deleteFeatureFlag('f1');

    expect(mockApi.featureFlagControllerRemove).toHaveBeenCalledWith('f1');
    expect(result.success).toBe(true);
  });
});

describe('setFeatureFlagRoles', () => {
  it('define os roles da flag repassando o dto', async () => {
    mockApi.featureFlagControllerSetRoles.mockResolvedValue({ id: 'f1', key: 'beta' });

    const result = await setFeatureFlagRoles('f1', { roleNames: ['ADMIN'] } as never);

    expect(mockApi.featureFlagControllerSetRoles).toHaveBeenCalledWith('f1', { roleNames: ['ADMIN'] });
    expect(result.success).toBe(true);
  });
});
