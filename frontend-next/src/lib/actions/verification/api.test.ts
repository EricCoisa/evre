import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCustomInstance = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/orval-instance', () => ({ customInstance: mockCustomInstance }));

import { requestVerification, confirmVerification, getVerificationChannelHealth } from './api';
import type { RequestVerificationInput, ConfirmVerificationInput } from './types';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requestVerification', () => {
  it('posta o input no endpoint de request', async () => {
    mockCustomInstance.mockResolvedValue({ expiresAt: '2026-01-01T00:00:00Z' });
    const input: RequestVerificationInput = { purpose: 'USER_PHONE_CONFIRMATION', channel: 'WHATSAPP' };

    const result = await requestVerification(input);

    expect(mockCustomInstance).toHaveBeenCalledWith({
      url: '/verification/request',
      method: 'POST',
      data: input,
    });
    expect(result).toMatchObject({ success: true, data: { expiresAt: '2026-01-01T00:00:00Z' } });
  });

  it('propaga falha como envelope de erro', async () => {
    mockCustomInstance.mockRejectedValue({ response: { status: 400, data: { message: 'canal inválido' } } });

    const result = await requestVerification({ purpose: 'x', channel: 'EMAIL' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('canal inválido');
  });
});

describe('confirmVerification', () => {
  it('posta o input no endpoint de confirm', async () => {
    mockCustomInstance.mockResolvedValue(undefined);
    const input: ConfirmVerificationInput = { purpose: 'USER_PHONE_CONFIRMATION', code: '123456' };

    const result = await confirmVerification(input);

    expect(mockCustomInstance).toHaveBeenCalledWith({
      url: '/verification/confirm',
      method: 'POST',
      data: input,
    });
    expect(result.success).toBe(true);
  });
});

describe('getVerificationChannelHealth', () => {
  it('busca a saúde do canal via query param', async () => {
    mockCustomInstance.mockResolvedValue({ operational: true });

    const result = await getVerificationChannelHealth('WHATSAPP');

    expect(mockCustomInstance).toHaveBeenCalledWith({
      url: '/verification/health',
      method: 'GET',
      params: { channel: 'WHATSAPP' },
    });
    expect(result).toMatchObject({ success: true, data: { operational: true } });
  });
});
