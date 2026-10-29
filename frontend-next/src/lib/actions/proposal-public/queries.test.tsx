import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  acceptPublicProposal: vi.fn(),
  requestProposalRenewal: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { acceptPublicProposal, requestProposalRenewal } from './api';
import { useApp } from '@/contexts/appProvider';
import { useAcceptPublicProposal, useRequestProposalRenewal } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApp).mockReturnValue({ emulateError: false } as never);
});

describe('useAcceptPublicProposal', () => {
  it('aceita a proposta pública repassando token e dados', async () => {
    vi.mocked(acceptPublicProposal).mockResolvedValue(ok({ acceptedAt: '2026-01-01T00:00:00.000Z' }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useAcceptPublicProposal(), { wrapper });
    result.current.mutate({ token: 'tok', data: { name: 'Ana', email: 'a@a.com' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(acceptPublicProposal).toHaveBeenCalledWith('tok', { name: 'Ana', email: 'a@a.com' });
    expect(result.current.data).toEqual({ acceptedAt: '2026-01-01T00:00:00.000Z' });
  });
});

describe('useRequestProposalRenewal', () => {
  it('solicita renovação repassando o token', async () => {
    vi.mocked(requestProposalRenewal).mockResolvedValue(ok(undefined) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useRequestProposalRenewal(), { wrapper });
    result.current.mutate('tok');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestProposalRenewal).toHaveBeenCalledWith('tok');
  });
});
