import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getUserRoles: vi.fn(),
  getUserRolesAccess: vi.fn(),
  grantRoleRouteAccess: vi.fn(),
  revokeRoleRouteAccess: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { getUserRoles, getUserRolesAccess, grantRoleRouteAccess, revokeRoleRouteAccess } from './api';
import { useApp } from '@/contexts/appProvider';
import { toast } from 'sonner';
import { useUserRole, useUserRoleAccess, useGrantRoleRouteAccess, useRevokeRoleRouteAccess } from './queries';

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

describe('useUserRole', () => {
  it('busca as roles de usuário repassando os params', async () => {
    vi.mocked(getUserRoles).mockResolvedValue(ok([{ roleId: 'r1', roleName: 'ADMIN' }]) as never);

    const { result } = renderHook(() => useUserRole({ page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserRoles).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data).toEqual([{ roleId: 'r1', roleName: 'ADMIN' }]);
  });
});

describe('useUserRoleAccess', () => {
  it('busca o acesso de rotas quando há routeId', async () => {
    vi.mocked(getUserRolesAccess).mockResolvedValue(ok([{ id: 'a1' }]) as never);

    const { result } = renderHook(() => useUserRoleAccess('r1', { page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserRolesAccess).toHaveBeenCalledWith('r1', { page: 1 });
  });

  it('não busca quando routeId é vazio (enabled: false)', () => {
    const { result } = renderHook(() => useUserRoleAccess(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getUserRolesAccess).not.toHaveBeenCalled();
  });
});

describe('useGrantRoleRouteAccess', () => {
  it('concede acesso e invalida roleRouteAccess da role', async () => {
    vi.mocked(grantRoleRouteAccess).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useGrantRoleRouteAccess(), { wrapper: clientWrapper });
    result.current.mutate({ roleId: 'r1', routeId: 'rt1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(grantRoleRouteAccess).toHaveBeenCalledWith('r1', 'rt1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['roleRouteAccess', 'r1'] });
  });

  it('emulateError=true lança erro antes de chamar a api', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useGrantRoleRouteAccess(), { wrapper: clientWrapper });
    result.current.mutate({ roleId: 'r1', routeId: 'rt1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(grantRoleRouteAccess).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Emulated error from useSetUserConfiguration');
  });
});

describe('useRevokeRoleRouteAccess', () => {
  it('revoga acesso e invalida roleRouteAccess da role', async () => {
    vi.mocked(revokeRoleRouteAccess).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useRevokeRoleRouteAccess(), { wrapper: clientWrapper });
    result.current.mutate({ roleId: 'r1', routeId: 'rt1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(revokeRoleRouteAccess).toHaveBeenCalledWith('r1', 'rt1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['roleRouteAccess', 'r1'] });
  });
});
