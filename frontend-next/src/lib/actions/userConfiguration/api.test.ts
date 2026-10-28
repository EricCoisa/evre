import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  userConfigurationControllerGetUserConfigurations: vi.fn(),
  userConfigurationControllerGetUserConfigurationsKey: vi.fn(),
  userConfigurationControllerSetUserConfiguration: vi.fn(),
  userConfigurationControllerResetUserConfiguration: vi.fn(),
}));

vi.mock('@/lib/generated/user-configuration/user-configuration', () => ({
  getUserConfiguration: () => mockApi,
}));

import {
  getUserConfigurations,
  getUserConfigurationByLabelKey,
  setUserConfiguration,
  resetUserConfiguration,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserConfigurations', () => {
  it('devolve envelope de sucesso com a lista', async () => {
    mockApi.userConfigurationControllerGetUserConfigurations.mockResolvedValue([{ id: 'c1' }]);

    const result = await getUserConfigurations();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 'c1' }]);
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.userConfigurationControllerGetUserConfigurations.mockRejectedValue(new Error('boom'));

    const result = await getUserConfigurations();

    expect(result.success).toBe(false);
  });
});

describe('getUserConfigurationByLabelKey', () => {
  it('busca por labelKey', async () => {
    mockApi.userConfigurationControllerGetUserConfigurationsKey.mockResolvedValue({ id: 'c1', value: 'v' });

    const result = await getUserConfigurationByLabelKey('SOME_KEY');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'c1', value: 'v' });
    expect(mockApi.userConfigurationControllerGetUserConfigurationsKey).toHaveBeenCalledWith('SOME_KEY');
  });
});

describe('setUserConfiguration', () => {
  it('converte o valor para string antes de enviar', async () => {
    mockApi.userConfigurationControllerSetUserConfiguration.mockResolvedValue({ id: 'c1', value: '42' });

    const result = await setUserConfiguration('c1', 42);

    expect(result.success).toBe(true);
    expect(mockApi.userConfigurationControllerSetUserConfiguration).toHaveBeenCalledWith({
      definitionId: 'c1',
      value: '42',
    });
  });

  it('converte booleano para string', async () => {
    mockApi.userConfigurationControllerSetUserConfiguration.mockResolvedValue({ id: 'c1', value: 'true' });

    await setUserConfiguration('c1', true);

    expect(mockApi.userConfigurationControllerSetUserConfiguration).toHaveBeenCalledWith({
      definitionId: 'c1',
      value: 'true',
    });
  });
});

describe('resetUserConfiguration', () => {
  it('reseta configuração por id', async () => {
    mockApi.userConfigurationControllerResetUserConfiguration.mockResolvedValue(undefined);

    const result = await resetUserConfiguration('c1');

    expect(result.success).toBe(true);
    expect(mockApi.userConfigurationControllerResetUserConfiguration).toHaveBeenCalledWith('c1');
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.userConfigurationControllerResetUserConfiguration.mockRejectedValue(new Error('boom'));

    const result = await resetUserConfiguration('c1');

    expect(result.success).toBe(false);
  });
});
