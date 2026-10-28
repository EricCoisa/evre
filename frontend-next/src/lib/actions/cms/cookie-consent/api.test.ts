import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPayload = vi.hoisted(() => vi.fn());
vi.mock('payload', () => ({ getPayload: mockGetPayload }));
vi.mock('@payload-config', () => ({ default: {} }));

import { getCookieConsent } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCookieConsent', () => {
  it('busca o global cookie-consent no Payload', async () => {
    const findGlobal = vi.fn().mockResolvedValue({ message: 'Usamos cookies', acceptButtonText: 'Aceitar' });
    mockGetPayload.mockResolvedValue({ findGlobal });

    const result = await getCookieConsent();

    expect(findGlobal).toHaveBeenCalledWith({ slug: 'cookie-consent' });
    expect(result).toEqual({ message: 'Usamos cookies', acceptButtonText: 'Aceitar' });
  });

  it('retorna null quando o Payload lança erro', async () => {
    mockGetPayload.mockRejectedValue(new Error('conexão falhou'));

    await expect(getCookieConsent()).resolves.toBeNull();
  });
});
