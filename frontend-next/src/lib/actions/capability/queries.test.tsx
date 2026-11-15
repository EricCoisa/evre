import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getCapabilities: vi.fn(),
}));
vi.mock('@/lib/api/collector', () => ({
  Collector: (fn: (...args: unknown[]) => Promise<{ data: unknown }>) =>
    async (...args: unknown[]) => {
      const r = await fn(...args) as { data: unknown };
      return r?.data ?? r;
    },
  Alive: (fn: () => unknown) => fn,
}));
vi.mock('@/contexts/appProvider', () => ({
  useApp: () => ({ emulateError: false }),
}));

import { getCapabilities } from './api';
import { useCapabilities, useCapability } from './queries';

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

describe('useCapabilities', () => {
  it('busca capabilities e retorna o mapa', async () => {
    vi.mocked(getCapabilities).mockResolvedValue(
      ok({ STORAGE: { operational: true } }) as never,
    );

    const { result } = renderHook(() => useCapabilities(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ STORAGE: { operational: true } });
    expect(getCapabilities).toHaveBeenCalledOnce();
  });
});

describe('useCapability', () => {
  it('retorna operational=true quando a capability existe e está operacional', async () => {
    vi.mocked(getCapabilities).mockResolvedValue(
      ok({ STORAGE: { operational: true, available: true } }) as never,
    );

    const { result } = renderHook(() => useCapability('STORAGE'), { wrapper });

    await waitFor(() => expect(result.current.operational).toBe(true));
    expect(result.current.disabled).toBe(false);
    expect(result.current.hidden).toBe(false);
  });

  it('retorna disabled=true quando operational=false', async () => {
    vi.mocked(getCapabilities).mockResolvedValue(
      ok({ STORAGE: { operational: false, available: true } }) as never,
    );

    const { result } = renderHook(() => useCapability('STORAGE'), { wrapper });

    await waitFor(() => expect(result.current.disabled).toBe(true));
  });
});
