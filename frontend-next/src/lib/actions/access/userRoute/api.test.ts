import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  userRouteAccessControllerFindAll: vi.fn(),
  userRouteAccessControllerCheckAccess: vi.fn(),
  userRouteAccessControllerGrant: vi.fn(),
  userRouteAccessControllerRevoke: vi.fn(),
}));

vi.mock('@/lib/generated/user-route-access/user-route-access', () => ({
  getUserRouteAccess: () => mockApi,
}));

import { getUserRouteAccess, getUserRouteAccessByPath, grantUserRouteAccess, revokeUserRouteAccess } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserRouteAccess', () => {
  it('normaliza os params de paginação e devolve envelope de sucesso', async () => {
    mockApi.userRouteAccessControllerFindAll.mockResolvedValue({ data: [], meta: {} });

    const result = await getUserRouteAccess({ page: 1, limit: 10 });

    expect(mockApi.userRouteAccessControllerFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 }),
    );
    expect(result).toEqual({ success: true, data: { data: [], meta: {} }, message: '', status: 200 });
  });

  it('sem params: chama a API com undefined', async () => {
    mockApi.userRouteAccessControllerFindAll.mockResolvedValue({ data: [], meta: {} });

    await getUserRouteAccess();

    expect(mockApi.userRouteAccessControllerFindAll).toHaveBeenCalledWith(undefined);
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.userRouteAccessControllerFindAll.mockRejectedValue({
      response: { status: 500, data: { message: 'falhou' } },
    });

    const result = await getUserRouteAccess();

    expect(result.success).toBe(false);
    expect(result.message).toBe('falhou');
  });
});

describe('getUserRouteAccessByPath', () => {
  it('extrai o primeiro segmento, ignorando query string e hash', async () => {
    mockApi.userRouteAccessControllerCheckAccess.mockResolvedValue(true);

    const result = await getUserRouteAccessByPath('/admin/users?x=1#frag');

    expect(mockApi.userRouteAccessControllerCheckAccess).toHaveBeenCalledWith({ path: '/admin' });
    expect(result).toMatchObject({ success: true, data: true });
  });

  it('path raiz "/" vira basePath "/"', async () => {
    mockApi.userRouteAccessControllerCheckAccess.mockResolvedValue(false);

    const result = await getUserRouteAccessByPath('/');

    expect(mockApi.userRouteAccessControllerCheckAccess).toHaveBeenCalledWith({ path: '/' });
    expect(result.data).toBe(false);
  });
});

describe('grantUserRouteAccess', () => {
  it('concede acesso de rota para o usuário', async () => {
    mockApi.userRouteAccessControllerGrant.mockResolvedValue(undefined);

    const result = await grantUserRouteAccess('u1', 'rt1');

    expect(mockApi.userRouteAccessControllerGrant).toHaveBeenCalledWith({ userId: 'u1', routeId: 'rt1' });
    expect(result.success).toBe(true);
  });
});

describe('revokeUserRouteAccess', () => {
  it('revoga acesso de rota do usuário', async () => {
    mockApi.userRouteAccessControllerRevoke.mockResolvedValue(undefined);

    const result = await revokeUserRouteAccess('u1', 'rt1');

    expect(mockApi.userRouteAccessControllerRevoke).toHaveBeenCalledWith('u1', 'rt1');
    expect(result.success).toBe(true);
  });
});
