import { Test } from '@nestjs/testing';
import { GetUserRoutesUseCase } from './get-user-routes.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoleHomeService } from 'src/modules/route/role-home.service';

const ROLE_UUID = 'uuid-admin-role';
const USER_ID = 'uuid-user';

const activeRoute = {
  id: 'route-1',
  path: '/dashboard',
  labelKey: 'dashboard',
  icon: null,
  parentId: null,
  ordem: 1,
  isActive: true,
  showSideBar: true,
};

const mockRoleHome = {
  routeIdFor: vi.fn().mockResolvedValue('route-1'),
};

const mockPrisma = {
  roleRouteAccess: { findMany: vi.fn() },
  userRouteAccess: { findMany: vi.fn() },
};

const deniedRoute = {
  ...activeRoute,
  id: 'route-2',
  path: '/reports',
};

describe('GetUserRoutesUseCase', () => {
  let useCase: GetUserRoutesUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        GetUserRoutesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RoleHomeService, useValue: mockRoleHome },
      ],
    }).compile();
    useCase = mod.get(GetUserRoutesUseCase);
    vi.clearAllMocks();
    mockRoleHome.routeIdFor.mockResolvedValue('route-1');
  });

  it('retorna rotas do role + rotas individuais usando roleId UUID diretamente', async () => {
    mockPrisma.roleRouteAccess.findMany.mockResolvedValue([
      { route: activeRoute },
    ]);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([]);

    const result = await useCase.execute(USER_ID, ROLE_UUID);

    expect(mockPrisma.roleRouteAccess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roleId: ROLE_UUID } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/dashboard');
  });

  it('retorna apenas rotas individuais quando roleId é null', async () => {
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([
      { route: activeRoute },
    ]);

    const result = await useCase.execute(USER_ID, null);

    expect(mockPrisma.roleRouteAccess.findMany).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('filtra rotas inativas', async () => {
    mockPrisma.roleRouteAccess.findMany.mockResolvedValue([
      { route: { ...activeRoute, isActive: false } },
    ]);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([]);

    const result = await useCase.execute(USER_ID, ROLE_UUID);
    expect(result).toHaveLength(0);
  });

  it('DENY individual remove rota herdada da role', async () => {
    mockPrisma.roleRouteAccess.findMany.mockResolvedValue([
      { route: activeRoute },
      { route: deniedRoute },
    ]);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([
      { denied: true, route: deniedRoute },
    ]);

    const result = await useCase.execute(USER_ID, ROLE_UUID);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/dashboard');
  });

  it('ALLOW individual adiciona rota que a role nao tem', async () => {
    mockPrisma.roleRouteAccess.findMany.mockResolvedValue([]);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([
      { denied: false, route: activeRoute },
    ]);

    const result = await useCase.execute(USER_ID, ROLE_UUID);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/dashboard');
  });
});

describe('GetUserRoutesUseCase — isHome derivado da configuração por role', () => {
  let useCase: GetUserRoutesUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        GetUserRoutesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RoleHomeService, useValue: mockRoleHome },
      ],
    }).compile();
    useCase = mod.get(GetUserRoutesUseCase);
    vi.clearAllMocks();
  });

  it('marca isHome na rota configurada para a role', async () => {
    mockRoleHome.routeIdFor.mockResolvedValue('route-1');
    mockPrisma.roleRouteAccess.findMany.mockResolvedValue([
      { route: activeRoute },
      { route: { ...activeRoute, id: 'route-9', path: '/outra' } },
    ]);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([]);

    const result = await useCase.execute(USER_ID, ROLE_UUID, 'ADMIN');

    expect(result.find((r) => r.id === 'route-1')?.isHome).toBe(true);
    expect(result.find((r) => r.id === 'route-9')?.isHome).toBe(false);
  });

  it('a mesma rota não é home para uma role sem configuração', async () => {
    mockRoleHome.routeIdFor.mockResolvedValue(null);
    mockPrisma.roleRouteAccess.findMany.mockResolvedValue([{ route: activeRoute }]);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([]);

    const result = await useCase.execute(USER_ID, ROLE_UUID, 'USER');

    expect(result[0].isHome).toBe(false);
  });
});
