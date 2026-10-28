import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  emailControllerSaveConfiguration: vi.fn(),
  emailControllerHealth: vi.fn(),
  emailControllerTemplates: vi.fn(),
}));

vi.mock('@/lib/generated/email/email', () => ({
  getEmail: () => mockApi,
}));

import { saveEmailConfiguration, getEmailHealth, getEmailTemplates } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveEmailConfiguration', () => {
  it('valida contra o provider e salva a configuração', async () => {
    mockApi.emailControllerSaveConfiguration.mockResolvedValue({ status: true, data: 'ok' });

    const payload = { provider: 'smtp' } as never;
    const result = await saveEmailConfiguration(payload);

    expect(mockApi.emailControllerSaveConfiguration).toHaveBeenCalledWith(payload);
    expect(result).toMatchObject({ success: true, data: { status: true, data: 'ok' } });
  });
});

describe('getEmailHealth', () => {
  it('busca o status de saúde do provider de email', async () => {
    mockApi.emailControllerHealth.mockResolvedValue({ operational: true });

    const result = await getEmailHealth();

    expect(mockApi.emailControllerHealth).toHaveBeenCalled();
    expect(result.data).toEqual({ operational: true });
  });
});

describe('getEmailTemplates', () => {
  it('lista os templates de email configurados', async () => {
    mockApi.emailControllerTemplates.mockResolvedValue([{ type: 'INVITATION', isDefault: true }]);

    const result = await getEmailTemplates();

    expect(mockApi.emailControllerTemplates).toHaveBeenCalled();
    expect(result.data).toEqual([{ type: 'INVITATION', isDefault: true }]);
  });
});
