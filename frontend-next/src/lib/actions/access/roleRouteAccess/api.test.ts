import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  roleRouteAccessControllerFindAllUserRole: vi.fn(),
  roleRouteAccessControllerFindByRole: vi.fn(),
  roleRouteAccessControllerCreate: vi.fn(),
  roleRouteAccessControllerRemove: vi.fn(),
}));

vi.mock('@/lib/generated/role-route-access/role-route-access', () => ({
  getRoleRouteAccess: () => mockApi,
}));

import { getUserRoles, getUserRolesAccess, grantRoleRouteAccess, revokeRoleRouteAccess } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserRoles', () => {
  it('normaliza os params de paginação e devolve envelope de sucesso', async () => {
    mockApi.roleRouteAccessControllerFindAllUserRole.mockResolvedValue([{ roleId: 'r1', roleName: 'ADMIN' }]);

    const result = await getUserRoles({ page: 1, limit: 10 });

    expect(mockApi.roleRouteAccessControllerFindAllUserRole).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 }),
    );
    expect(result).toMatchObject({ success: true, data: [{ roleId: 'r1', roleName: 'ADMIN' }] });
  });

  it('sem params: chama a API com undefined', async () => {
    mockApi.roleRouteAccessControllerFindAllUserRole.mockResolvedValue([]);

    await getUserRoles();

    expect(mockApi.roleRouteAccessControllerFindAllUserRole).toHaveBeenCalledWith(undefined);
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.roleRouteAccessControllerFindAllUserRole.mockRejectedValue({
      response: { status: 500, data: { message: 'falhou' } },
    });

    const result = await getUserRoles();

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.message).toBe('falhou');
  });
});

describe('getUserRolesAccess', () => {
  it('busca o acesso de rotas por role e normaliza os params', async () => {
    mockApi.roleRouteAccessControllerFindByRole.mockResolvedValue([{ id: 'a1', roleId: 'r1', routeId: 'rt1' }]);

    const result = await getUserRolesAccess('r1', { page: 2 });

    expect(mockApi.roleRouteAccessControllerFindByRole).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ page: 2 }),
    );
    expect(result.success).toBe(true);
  });

  it('sem params: chama a API com undefined', async () => {
    mockApi.roleRouteAccessControllerFindByRole.mockResolvedValue([]);

    await getUserRolesAccess('r1');

    expect(mockApi.roleRouteAccessControllerFindByRole).toHaveBeenCalledWith('r1', undefined);
  });
});

describe('grantRoleRouteAccess', () => {
  it('concede acesso de rota para a role', async () => {
    mockApi.roleRouteAccessControllerCreate.mockResolvedValue(undefined);

    const result = await grantRoleRouteAccess('r1', 'rt1');

    expect(mockApi.roleRouteAccessControllerCreate).toHaveBeenCalledWith({ roleId: 'r1', routeId: 'rt1' });
    expect(result.success).toBe(true);
  });
});

describe('revokeRoleRouteAccess', () => {
  it('revoga acesso de rota da role', async () => {
    mockApi.roleRouteAccessControllerRemove.mockResolvedValue(undefined);

    const result = await revokeRoleRouteAccess('r1', 'rt1');

    expect(mockApi.roleRouteAccessControllerRemove).toHaveBeenCalledWith('r1', 'rt1');
    expect(result.success).toBe(true);
  });
});
