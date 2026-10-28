import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  systemConfigurationControllerFindByLabelKey: vi.fn(),
  systemConfigurationControllerFindSignupConfiguration: vi.fn(),
  systemConfigurationControllerFindDefaultThemeConfiguration: vi.fn(),
  systemConfigurationControllerUpdate: vi.fn(),
}));

vi.mock('@/lib/generated/system-configuration/system-configuration', () => ({
  getSystemConfiguration: () => mockApi,
}));

import {
  getSystemConfiguration,
  getSignupConfiguration,
  getDefaultThemeConfiguration,
  updateSystemConfiguration,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSystemConfiguration', () => {
  it('busca configuração por labelKey e devolve envelope de sucesso', async () => {
    mockApi.systemConfigurationControllerFindByLabelKey.mockResolvedValue({ id: 's1', value: 'v' });

    const result = await getSystemConfiguration('SOME_KEY');

    expect(mockApi.systemConfigurationControllerFindByLabelKey).toHaveBeenCalledWith('SOME_KEY');
    expect(result).toMatchObject({ success: true, data: { id: 's1', value: 'v' } });
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.systemConfigurationControllerFindByLabelKey.mockRejectedValue({
      response: { status: 404, data: { message: 'não encontrado' } },
    });

    const result = await getSystemConfiguration('SOME_KEY');

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(result.message).toBe('não encontrado');
  });
});

describe('getSignupConfiguration', () => {
  it('busca a configuração de signup', async () => {
    mockApi.systemConfigurationControllerFindSignupConfiguration.mockResolvedValue({ id: 's2', value: true });

    const result = await getSignupConfiguration();

    expect(mockApi.systemConfigurationControllerFindSignupConfiguration).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, data: { id: 's2', value: true } });
  });
});

describe('getDefaultThemeConfiguration', () => {
  it('busca a configuração de tema default', async () => {
    mockApi.systemConfigurationControllerFindDefaultThemeConfiguration.mockResolvedValue({ id: 's3', value: 'dark' });

    const result = await getDefaultThemeConfiguration();

    expect(mockApi.systemConfigurationControllerFindDefaultThemeConfiguration).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, data: { id: 's3', value: 'dark' } });
  });
});

describe('updateSystemConfiguration', () => {
  it('envia o valor sem convertê-lo para string', async () => {
    mockApi.systemConfigurationControllerUpdate.mockResolvedValue({ id: 's1', value: 'dark' });

    const result = await updateSystemConfiguration('s1', 'dark');

    expect(mockApi.systemConfigurationControllerUpdate).toHaveBeenCalledWith('s1', { value: 'dark' });
    expect(result.success).toBe(true);
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.systemConfigurationControllerUpdate.mockRejectedValue(new Error('boom'));

    const result = await updateSystemConfiguration('s1', 'dark');

    expect(result.success).toBe(false);
  });
});
