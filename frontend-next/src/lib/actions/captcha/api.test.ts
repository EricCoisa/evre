import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  captchaControllerConfig: vi.fn(),
  captchaControllerSaveConfig: vi.fn(),
  captchaControllerProviders: vi.fn(),
}));

vi.mock('@/lib/generated/captcha/captcha', () => ({
  getCaptcha: () => mockApi,
}));

import { getCaptchaConfig, getCaptchaProviders, saveCaptchaConfig } from './api';
import type { SaveCaptchaConfigDto } from '@/lib/generated/schemas';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCaptchaConfig', () => {
  it('busca a config pública de captcha', async () => {
    mockApi.captchaControllerConfig.mockResolvedValue({ provider: 'TURNSTILE', siteKey: 'x', enabled: true });

    const result = await getCaptchaConfig();

    expect(mockApi.captchaControllerConfig).toHaveBeenCalledWith();
    expect(result).toMatchObject({ success: true, data: { provider: 'TURNSTILE', enabled: true } });
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.captchaControllerConfig.mockRejectedValue({ response: { status: 500, data: { message: 'falhou' } } });

    const result = await getCaptchaConfig();

    expect(result.success).toBe(false);
    expect(result.message).toBe('falhou');
  });
});

describe('getCaptchaProviders', () => {
  it('lista os providers de captcha suportados', async () => {
    mockApi.captchaControllerProviders.mockResolvedValue([{ id: 'TURNSTILE', scriptUrl: 'https://x' }]);

    const result = await getCaptchaProviders();

    expect(mockApi.captchaControllerProviders).toHaveBeenCalledWith();
    expect(result.data).toEqual([{ id: 'TURNSTILE', scriptUrl: 'https://x' }]);
  });
});

describe('saveCaptchaConfig', () => {
  it('valida e salva a configuração de captcha', async () => {
    mockApi.captchaControllerSaveConfig.mockResolvedValue(undefined);
    const payload = { provider: 'TURNSTILE', siteKey: 'x', secretKey: 'y' } as unknown as SaveCaptchaConfigDto;

    const result = await saveCaptchaConfig(payload);

    expect(mockApi.captchaControllerSaveConfig).toHaveBeenCalledWith(payload);
    expect(result.success).toBe(true);
  });
});
