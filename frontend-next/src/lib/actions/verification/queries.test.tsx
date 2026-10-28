import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  requestVerification: vi.fn(),
  confirmVerification: vi.fn(),
  getVerificationChannelHealth: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: () => ({ emulateError: false }) }));

import { requestVerification, confirmVerification, getVerificationChannelHealth } from './api';
import { useRequestVerification, useConfirmVerification, useVerificationChannelHealth } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRequestVerification', () => {
  it('solicita a verificação com o input informado', async () => {
    vi.mocked(requestVerification).mockResolvedValue(ok({ expiresAt: '2026-01-01T00:00:00Z' }) as never);

    const { result } = renderHook(() => useRequestVerification(), { wrapper });
    const data = await result.current.mutateAsync({ purpose: 'USER_PHONE_CONFIRMATION', channel: 'WHATSAPP' });

    expect(requestVerification).toHaveBeenCalledWith({ purpose: 'USER_PHONE_CONFIRMATION', channel: 'WHATSAPP' });
    expect(data).toEqual({ expiresAt: '2026-01-01T00:00:00Z' });
  });
});

describe('useConfirmVerification', () => {
  it('confirma a verificação com o input informado', async () => {
    vi.mocked(confirmVerification).mockResolvedValue(ok(undefined) as never);

    const { result } = renderHook(() => useConfirmVerification(), { wrapper });
    await result.current.mutateAsync({ purpose: 'USER_PHONE_CONFIRMATION', code: '123456' });

    expect(confirmVerification).toHaveBeenCalledWith({ purpose: 'USER_PHONE_CONFIRMATION', code: '123456' });
  });
});

describe('useVerificationChannelHealth', () => {
  it('busca a saúde do canal informado', async () => {
    vi.mocked(getVerificationChannelHealth).mockResolvedValue(ok({ operational: true }) as never);

    const { result } = renderHook(() => useVerificationChannelHealth('WHATSAPP'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getVerificationChannelHealth).toHaveBeenCalledWith('WHATSAPP');
    expect(result.current.data).toEqual({ operational: true });
  });
});
