import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({ getUserRouteAccess: vi.fn() }));
vi.mock('@/contexts/appProvider', () => ({ useApp: () => ({ emulateError: false }) }));

import { getUserRouteAccess } from './api';
import { useUserRouteAccess } from './queries';

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

describe('useUserRouteAccess', () => {
  it('busca o acesso de rotas do usuário repassando os params', async () => {
    const page = { data: [{ id: 'a1' }], meta: { total: 1 } };
    vi.mocked(getUserRouteAccess).mockResolvedValue(ok(page) as never);

    const { result } = renderHook(() => useUserRouteAccess({ page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserRouteAccess).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data).toEqual(page);
  });

  it('sem params: chama a API com undefined', async () => {
    vi.mocked(getUserRouteAccess).mockResolvedValue(ok({ data: [], meta: {} }) as never);

    const { result } = renderHook(() => useUserRouteAccess(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserRouteAccess).toHaveBeenCalledWith(undefined);
  });
});
