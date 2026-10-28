import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  userConfigurationDefinitionControllerFindByLabelKey: vi.fn(),
  userConfigurationDefinitionControllerSetDefinitionDefault: vi.fn(),
}));

vi.mock('@/lib/generated/user-configuration-definitions/user-configuration-definitions', () => ({
  getUserConfigurationDefinitions: () => mockApi,
}));

import { getUserConfigurationsDefinitions, updateUserConfigurationsDefinitions } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserConfigurationsDefinitions', () => {
  it('busca a definição por labelKey', async () => {
    mockApi.userConfigurationDefinitionControllerFindByLabelKey.mockResolvedValue({ id: 'd1', defaultValue: '10' });

    const result = await getUserConfigurationsDefinitions('SOME_KEY');

    expect(mockApi.userConfigurationDefinitionControllerFindByLabelKey).toHaveBeenCalledWith('SOME_KEY');
    expect(result).toMatchObject({ success: true, data: { id: 'd1', defaultValue: '10' } });
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.userConfigurationDefinitionControllerFindByLabelKey.mockRejectedValue(new Error('boom'));

    const result = await getUserConfigurationsDefinitions('SOME_KEY');

    expect(result.success).toBe(false);
  });
});

describe('updateUserConfigurationsDefinitions', () => {
  it('converte o defaultValue numérico para string antes de enviar', async () => {
    mockApi.userConfigurationDefinitionControllerSetDefinitionDefault.mockResolvedValue({ id: 'd1', defaultValue: '42' });

    const result = await updateUserConfigurationsDefinitions('d1', 42);

    expect(mockApi.userConfigurationDefinitionControllerSetDefinitionDefault).toHaveBeenCalledWith('d1', {
      defaultValue: '42',
    });
    expect(result.success).toBe(true);
  });

  it('converte o defaultValue booleano para string antes de enviar', async () => {
    mockApi.userConfigurationDefinitionControllerSetDefinitionDefault.mockResolvedValue({ id: 'd1', defaultValue: 'false' });

    await updateUserConfigurationsDefinitions('d1', false);

    expect(mockApi.userConfigurationDefinitionControllerSetDefinitionDefault).toHaveBeenCalledWith('d1', {
      defaultValue: 'false',
    });
  });
});
