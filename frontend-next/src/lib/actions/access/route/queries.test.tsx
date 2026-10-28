import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getHomeRoute: vi.fn(),
  getRoleHomes: vi.fn(),
  getRouteByPath: vi.fn(),
  getRoutes: vi.fn(),
  saveRoleHomes: vi.fn(),
  updateRoute: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { getHomeRoute, getRoleHomes, getRouteByPath, getRoutes, saveRoleHomes, updateRoute } from './api';
import { useApp } from '@/contexts/appProvider';
import { toast } from 'sonner';
import { useRoutes, useHome, useRoute, useUpdateRoute, useRoleHomes, useSaveRoleHomes } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const clientWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper: clientWrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApp).mockReturnValue({ emulateError: false } as never);
});

describe('useRoutes', () => {
  it('busca rotas repassando os params', async () => {
    vi.mocked(getRoutes).mockResolvedValue(ok([{ id: 'r1' }]) as never);

    const { result } = renderHook(() => useRoutes({ page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRoutes).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data).toEqual([{ id: 'r1' }]);
  });
});

describe('useHome', () => {
  it('busca a rota home sem argumentos', async () => {
    vi.mocked(getHomeRoute).mockResolvedValue(ok({ id: 'home' }) as never);

    const { result } = renderHook(() => useHome(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getHomeRoute).toHaveBeenCalledWith();
  });
});

describe('useRoute', () => {
  it('busca pelo path quando ele existe', async () => {
    vi.mocked(getRouteByPath).mockResolvedValue(ok({ id: 'r1', path: '/foo' }) as never);

    const { result } = renderHook(() => useRoute('/foo'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRouteByPath).toHaveBeenCalledWith('/foo');
  });

  it('não busca quando o path é vazio (enabled: false)', () => {
    const { result } = renderHook(() => useRoute(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getRouteByPath).not.toHaveBeenCalled();
  });
});

describe('useUpdateRoute', () => {
  it('atualiza a rota e invalida routes', async () => {
    vi.mocked(updateRoute).mockResolvedValue(ok({ id: 'r1', path: '/novo' }) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateRoute(), { wrapper: clientWrapper });
    result.current.mutate({ id: 'r1', data: { path: '/novo' } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateRoute).toHaveBeenCalledWith('r1', { path: '/novo' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['routes'] });
  });

  it('emulateError=true lança erro antes de chamar a api', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateRoute(), { wrapper: clientWrapper });
    result.current.mutate({ id: 'r1', data: { path: '/novo' } as never });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(updateRoute).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Emulated error from useSetUserConfiguration');
  });
});

describe('useRoleHomes', () => {
  it('busca o mapa de role homes', async () => {
    vi.mocked(getRoleHomes).mockResolvedValue(ok({ admin: '/admin' }) as never);

    const { result } = renderHook(() => useRoleHomes(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ admin: '/admin' });
  });
});

describe('useSaveRoleHomes', () => {
  it('salva e invalida routes/role-home e me', async () => {
    vi.mocked(saveRoleHomes).mockResolvedValue(ok({ admin: '/admin' }) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useSaveRoleHomes(), { wrapper: clientWrapper });
    result.current.mutate({ admin: '/admin' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saveRoleHomes).toHaveBeenCalledWith({ admin: '/admin' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['routes', 'role-home'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me'] });
  });
});
