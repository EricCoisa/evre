import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getUsers: vi.fn(),
  getUser: vi.fn(),
  getRoles: vi.fn(),
  getStatus: vi.fn(),
  getUserRoutes: vi.fn(),
  getUserRoutesManagement: vi.fn(),
  deleteUser: vi.fn(),
  getInvites: vi.fn(),
  deleteInvite: vi.fn(),
}));
vi.mock('@/lib/actions/access/userRoute/api', () => ({
  grantUserRouteAccess: vi.fn(),
  revokeUserRouteAccess: vi.fn(),
}));
vi.mock('@/lib/actions/storage/api', () => ({
  getStorageHealth: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({
  useApp: () => ({ emulateError: false }),
}));

import {
  getUsers,
  getUser,
  getRoles,
  getStatus,
  getUserRoutes,
  getUserRoutesManagement,
  deleteUser,
  getInvites,
  deleteInvite,
} from './api';
import { grantUserRouteAccess, revokeUserRouteAccess } from '@/lib/actions/access/userRoute/api';
import { getStorageHealth } from '@/lib/actions/storage/api';
import {
  useUsers,
  useUser,
  useRoles,
  useUserStatus,
  useUserRoutes,
  useUserRoutesManagement,
  useDeleteUser,
  useGrantUserRouteAccess,
  useInvites,
  useStorageHealth,
  useDeleteInvite,
  useRevokeUserRouteAccess,
} from './queries';

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

describe('useUsers', () => {
  it('busca a lista de usuários', async () => {
    vi.mocked(getUsers).mockResolvedValue(ok([{ id: 'u1' }]) as never);

    const { result } = renderHook(() => useUsers({ page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'u1' }]);
    expect(getUsers).toHaveBeenCalledWith({ page: 1 });
  });
});

describe('useUser', () => {
  it('busca um usuário por id', async () => {
    vi.mocked(getUser).mockResolvedValue(ok({ id: 'u1' }) as never);

    const { result } = renderHook(() => useUser('u1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUser).toHaveBeenCalledWith('u1');
  });
});

describe('useRoles', () => {
  it('busca roles', async () => {
    vi.mocked(getRoles).mockResolvedValue(ok([{ value: 'admin', label: 'Admin' }]) as never);

    const { result } = renderHook(() => useRoles(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ value: 'admin', label: 'Admin' }]);
  });
});

describe('useUserStatus', () => {
  it('busca status', async () => {
    vi.mocked(getStatus).mockResolvedValue(ok([{ value: 'ACTIVE', label: 'Ativo' }]) as never);

    const { result } = renderHook(() => useUserStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUserRoutes', () => {
  it('busca rotas do usuário quando userId existe', async () => {
    vi.mocked(getUserRoutes).mockResolvedValue(ok([]) as never);

    const { result } = renderHook(() => useUserRoutes('u1', { page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserRoutes).toHaveBeenCalledWith('u1', { page: 1 });
  });

  it('não busca quando userId é vazio (enabled: false)', () => {
    const { result } = renderHook(() => useUserRoutes(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getUserRoutes).not.toHaveBeenCalled();
  });
});

describe('useUserRoutesManagement', () => {
  it('busca rotas de gestão do usuário', async () => {
    vi.mocked(getUserRoutesManagement).mockResolvedValue(ok([]) as never);

    const { result } = renderHook(() => useUserRoutesManagement('u1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserRoutesManagement).toHaveBeenCalledWith('u1', undefined);
  });
});

describe('useDeleteUser', () => {
  it('deleta usuário e invalida a query de usuários', async () => {
    vi.mocked(deleteUser).mockResolvedValue(ok(undefined) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    result.current.mutate('u1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteUser).toHaveBeenCalledWith('u1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] });
  });
});

describe('useGrantUserRouteAccess', () => {
  it('concede acesso e invalida as queries relacionadas', async () => {
    vi.mocked(grantUserRouteAccess).mockResolvedValue(ok(undefined) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useGrantUserRouteAccess(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    result.current.mutate({ userId: 'u1', routeId: 'r1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(grantUserRouteAccess).toHaveBeenCalledWith('u1', 'r1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users', 'u1', 'routes-management'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users', 'u1', 'routes'] });
  });
});

describe('useInvites', () => {
  it('busca convites', async () => {
    vi.mocked(getInvites).mockResolvedValue(ok([]) as never);

    const { result } = renderHook(() => useInvites(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useStorageHealth', () => {
  it('busca saúde do storage', async () => {
    vi.mocked(getStorageHealth).mockResolvedValue(ok({ healthy: true }) as never);

    const { result } = renderHook(() => useStorageHealth(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteInvite', () => {
  it('deleta convite e invalida a query de convites', async () => {
    vi.mocked(deleteInvite).mockResolvedValue(ok(undefined) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteInvite(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    result.current.mutate('inv1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteInvite).toHaveBeenCalledWith('inv1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['invites'] });
  });
});

describe('useRevokeUserRouteAccess', () => {
  it('revoga acesso e invalida as queries relacionadas', async () => {
    vi.mocked(revokeUserRouteAccess).mockResolvedValue(ok(undefined) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useRevokeUserRouteAccess(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    result.current.mutate({ userId: 'u1', routeId: 'r1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(revokeUserRouteAccess).toHaveBeenCalledWith('u1', 'r1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users', 'u1', 'routes-management'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users', 'u1', 'routes'] });
  });
});
