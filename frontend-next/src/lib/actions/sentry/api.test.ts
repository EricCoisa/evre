import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  sentryConfigControllerSaveConfig: vi.fn(),
}));

vi.mock('@/lib/generated/sentry/sentry', () => ({
  getSentry: () => mockApi,
}));

import { saveSentryConfig } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveSentryConfig', () => {
  it('salva a configuração do Sentry', async () => {
    mockApi.sentryConfigControllerSaveConfig.mockResolvedValue(undefined);

    const payload = { dsn: 'https://dsn.example' } as never;
    const result = await saveSentryConfig(payload);

    expect(mockApi.sentryConfigControllerSaveConfig).toHaveBeenCalledWith(payload);
    expect(result.success).toBe(true);
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.sentryConfigControllerSaveConfig.mockRejectedValue({
      response: { status: 400, data: { message: 'DSN inválido' } },
    });

    const result = await saveSentryConfig({ dsn: 'invalid' } as never);

    expect(result.success).toBe(false);
    expect(result.message).toBe('DSN inválido');
  });
});
