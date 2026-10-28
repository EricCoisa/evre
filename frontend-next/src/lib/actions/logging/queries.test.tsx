import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getLoggings: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));

import { getLoggings } from './api';
import { useApp } from '@/contexts/appProvider';
import { useLogging } from './queries';

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

describe('useLogging', () => {
  it('busca os logs repassando os params', async () => {
    vi.mocked(getLoggings).mockResolvedValue(ok([{ id: 'l1' }]) as never);

    const { result } = renderHook(() => useLogging({ page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getLoggings).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data).toEqual([{ id: 'l1' }]);
  });
});
