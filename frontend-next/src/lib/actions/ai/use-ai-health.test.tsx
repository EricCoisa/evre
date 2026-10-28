import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({ getAiHealth: vi.fn() }));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { getAiHealth } from './api';
import { useApp } from '@/contexts/appProvider';
import { useAiHealth } from './use-ai-health';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApp).mockReturnValue({ emulateError: false } as never);
});

describe('useAiHealth', () => {
  it('expõe os campos de saúde quando operacional', async () => {
    vi.mocked(getAiHealth).mockResolvedValue(ok({
      operational: true,
      byokRequired: false,
      userKeyConfigured: true,
    }) as never);

    const { result } = renderHook(() => useAiHealth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.operational).toBe(true);
    expect(result.current.byokRequired).toBe(false);
    expect(result.current.userKeyConfigured).toBe(true);
  });

  it('usa os valores default quando ainda não há dado (loading)', () => {
    vi.mocked(getAiHealth).mockReturnValue(new Promise(() => {}) as never);

    const { result } = renderHook(() => useAiHealth(), { wrapper });

    expect(result.current.operational).toBe(false);
    expect(result.current.byokRequired).toBe(false);
    expect(result.current.userKeyConfigured).toBe(false);
    expect(result.current.reason).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('repassa o motivo quando não está operacional', async () => {
    vi.mocked(getAiHealth).mockResolvedValue(ok({
      operational: false,
      reason: 'sem chave configurada',
      byokRequired: true,
    }) as never);

    const { result } = renderHook(() => useAiHealth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.operational).toBe(false);
    expect(result.current.reason).toBe('sem chave configurada');
    expect(result.current.byokRequired).toBe(true);
  });
});
