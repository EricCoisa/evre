import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';
import type { LoggingService } from '../../logging/logging.service';
import { FindAllRoleRouteAccessUseCase } from './find-all.use-case';
import { FindOneRoleRouteAccessUseCase } from './find-one.use-case';
import { CreateRoleRouteAccessUseCase } from './create.use-case';
import { RemoveRoleRouteAccessUseCase } from './remove.use-case';
import { FindAllUserRoleUseCase } from './find-all-user-role.use-case';
import { FindByRoleUseCase } from './find-by-role.use-case';
import { RemoveByRoleUseCase } from './remove-by-role.use-case';
import type { RouteCeilingRegistry } from '../../../common/infrastructure/route-ceiling/route-ceiling.registry';


const mockPrisma = {
  roleRouteAccess: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  route: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  role: {
    findMany: vi.fn(),
    findUnique: vi.fn().mockResolvedValue({ id: 'ADMIN', name: 'ADMIN' }),
  },
};
const mockI18n = { t: vi.fn((k: string) => k) };
const mockLogging = { create: vi.fn().mockResolvedValue({}) };
const mockRouteCeilings = { allowedRolesFor: vi.fn().mockReturnValue([]) };

const prisma = mockPrisma as unknown as PrismaService;
const i18n = mockI18n as unknown as I18nService;
const logging = mockLogging as unknown as LoggingService;
const routeCeilings = mockRouteCeilings as unknown as RouteCeilingRegistry;

const base = { page: 1, limit: 10, pagination: false, search: undefined, filter: undefined };
const paged = { ...base, pagination: true };

const access = {
  roleId: 'ADMIN',
  routeId: 'route-1',
  route: { id: 'route-1', path: '/admin', labelKey: 'admin', icon: null, isActive: true },
};

beforeEach(() => vi.clearAllMocks());

describe('FindAllRoleRouteAccessUseCase', () => {
  const useCase = () => new FindAllRoleRouteAccessUseCase(prisma);

  it('devolve array quando pagination=false', async () => {
    mockPrisma.roleRouteAccess.findMany.mockResolvedValue([access]);
    expect(Array.isArray(await useCase().execute(base))).toBe(true);
  });

  it('devolve data+meta quando pagination=true', async () => {
    mockPrisma.roleRouteAccess.findMany.mockResolvedValue([access]);
    mockPrisma.roleRouteAccess.count.mockResolvedValue(1);
    const result = await useCase().execute(paged);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
  });
});

describe('FindOneRoleRouteAccessUseCase', () => {
  const useCase = () => new FindOneRoleRouteAccessUseCase(prisma, i18n);

  it('devolve o acesso quando existe', async () => {
    mockPrisma.roleRouteAccess.findUnique.mockResolvedValue(access);
    await expect(useCase().execute('ADMIN', 'route-1')).resolves.toEqual(access);
  });

  it('lança NotFoundException quando não existe', async () => {
    mockPrisma.roleRouteAccess.findUnique.mockResolvedValue(null);
    await expect(useCase().execute('ADMIN', 'missing')).rejects.toThrow(NotFoundException);
  });
});

describe('CreateRoleRouteAccessUseCase', () => {
  const useCase = () =>
    new CreateRoleRouteAccessUseCase(prisma, i18n, logging, routeCeilings);

  it('lança NotFoundException quando a rota não existe', async () => {
    mockPrisma.route.findUnique.mockResolvedValue(null);
    await expect(
      useCase().execute({ roleId: 'ADMIN', routeId: 'missing' } as never, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança ConflictException quando o acesso já existe', async () => {
    mockPrisma.route.findUnique.mockResolvedValue({ id: 'route-1', path: '/admin' });
    mockPrisma.roleRouteAccess.findUnique.mockResolvedValue(access);
    await expect(
      useCase().execute({ roleId: 'ADMIN', routeId: 'route-1' } as never, 'u1'),
    ).rejects.toThrow(ConflictException);
  });

  it('lança ForbiddenException quando o papel está fora do teto da rota', async () => {
    mockPrisma.route.findUnique.mockResolvedValue({ id: 'route-1', path: '/admin' });
    mockRouteCeilings.allowedRolesFor.mockReturnValueOnce(['MODERATOR']);
    await expect(
      useCase().execute({ roleId: 'ADMIN', routeId: 'route-1' } as never, 'u1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('devolve o registro criado', async () => {
    mockPrisma.route.findUnique.mockResolvedValue({
      id: 'route-1', path: '/admin', labelKey: 'admin',
    });
    mockPrisma.roleRouteAccess.findUnique.mockResolvedValue(null);
    mockPrisma.roleRouteAccess.create.mockResolvedValue(access);
    await expect(
      useCase().execute({ roleId: 'ADMIN', routeId: 'route-1' } as never, 'u1'),
    ).resolves.toEqual(access);
  });
});

describe('RemoveRoleRouteAccessUseCase', () => {
  const useCase = () => new RemoveRoleRouteAccessUseCase(prisma, i18n, logging);

  it('lança NotFoundException quando o acesso não existe', async () => {
    mockPrisma.roleRouteAccess.findUnique.mockResolvedValue(null);
    await expect(useCase().execute('u1', 'ADMIN', 'route-1')).rejects.toThrow(NotFoundException);
  });

  it('deleta e devolve status true', async () => {
    mockPrisma.roleRouteAccess.findUnique.mockResolvedValue({
      ...access, route: { path: '/admin', labelKey: 'admin' },
    });
    mockPrisma.roleRouteAccess.delete.mockResolvedValue({});
    await expect(useCase().execute('u1', 'ADMIN', 'route-1')).resolves.toHaveProperty(
      'status',
      true,
    );
  });
});

describe('FindAllUserRoleUseCase', () => {
  const useCase = () => new FindAllUserRoleUseCase(prisma);

  it('devolve todas as roles sem paginação', async () => {
    mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-1' }, { id: 'role-2' }]);
    const result = await useCase().execute(base);
    expect(result).toHaveLength(2);
  });

  it('devolve data+meta com paginação', async () => {
    mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-1' }, { id: 'role-2' }]);
    const result = await useCase().execute(paged);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
  });
});

describe('FindByRoleUseCase', () => {
  const useCase = () => new FindByRoleUseCase(prisma, i18n, routeCeilings);
  const routeRow = (accesses: unknown[]) => ({
    ...access.route,
    roleRouteAccesses: accesses,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('marca hasAccess sem paginação', async () => {
    mockPrisma.route.findMany.mockResolvedValue([routeRow([{ roleId: 'ADMIN', routeId: 'route-1' }])]);
    expect(Array.isArray(await useCase().execute('ADMIN', base))).toBe(true);
  });

  it('lança NotFoundException quando a role não existe', async () => {
    mockPrisma.role.findUnique.mockResolvedValueOnce(null);
    await expect(useCase().execute('missing', base)).rejects.toThrow(NotFoundException);
  });

  it('filtra rotas pelo teto do RouteCeilingRegistry', async () => {
    mockPrisma.route.findMany.mockResolvedValue([
      { ...routeRow([]), id: 'r1', path: '/allowed' },
      { ...routeRow([]), id: 'r2', path: '/blocked' },
    ]);
    mockRouteCeilings.allowedRolesFor.mockImplementation((path: string) =>
      path === '/blocked' ? ['OTHER'] : [],
    );
    const result = (await useCase().execute('ADMIN', base)) as unknown as Array<{
      path: string;
    }>;
    expect(result.map((r) => r.path)).toEqual(['/allowed']);
    mockRouteCeilings.allowedRolesFor.mockReturnValue([]);
  });

  it('hasAccess=false deixa route indefinido', async () => {
    mockPrisma.route.findMany.mockResolvedValue([routeRow([])]);
    const [row] = (await useCase().execute('ADMIN', base)) as unknown as Array<{
      hasAccess: boolean;
      route?: unknown;
    }>;
    expect(row.hasAccess).toBe(false);
    expect(row.route).toBeUndefined();
  });

  it('pagina com busca', async () => {
    mockPrisma.route.findMany.mockResolvedValue([routeRow([])]);
    mockPrisma.route.count.mockResolvedValue(1);
    await expect(useCase().execute('ADMIN', { ...paged, search: 'admin' })).resolves.toHaveProperty(
      'data',
    );
  });

  it('hasAccess=true preenche route na resposta paginada', async () => {
    mockPrisma.route.findMany.mockResolvedValue([routeRow([{ roleId: 'ADMIN', routeId: 'route-1' }])]);
    mockPrisma.route.count.mockResolvedValue(1);
    const result = (await useCase().execute('ADMIN', paged)) as unknown as {
      data: Array<{ hasAccess: boolean; route?: unknown }>;
    };
    expect(result.data[0].hasAccess).toBe(true);
    expect(result.data[0].route).toBeDefined();
  });
});

describe('RemoveByRoleUseCase', () => {
  const useCase = () => new RemoveByRoleUseCase(prisma, i18n, logging);

  it('apaga todos os acessos da role e devolve a contagem', async () => {
    mockPrisma.roleRouteAccess.findMany.mockResolvedValue([
      { roleId: 'ADMIN', route: { path: '/admin', labelKey: 'admin' } },
    ]);
    mockPrisma.roleRouteAccess.deleteMany.mockResolvedValue({ count: 1 });
    const result = await useCase().execute('ADMIN', 'admin');
    expect(result).toHaveProperty('count', 1);
    expect(result).toHaveProperty('message');
    expect(mockPrisma.roleRouteAccess.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ roleId: 'ADMIN' }) }),
    );
  });
});
