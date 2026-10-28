import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';
import type { LoggingService } from '../../logging/logging.service';
import type { PayloadUserRepository } from '../../auth/adapters/payload-user.repository';
import type { RedisService } from '../../../common/infrastructure/redis/redis.service';
import type { RouteCeilingRegistry } from '../../../common/infrastructure/route-ceiling/route-ceiling.registry';
import { FindAllUserRouteAccessUseCase } from './find-all.use-case';
import { FindAllByOneUseCase } from './find-all-by-one.use-case';
import { GrantAccessUseCase } from './grant-access.use-case';
import { RevokeAccessUseCase } from './revoke-access.use-case';
import { RevokeAllAccessUseCase } from './revoke-all-access.use-case';
import { FindAllRoutesWithUserAccessUseCase } from './find-all-routes-with-user-access.use-case';
import { CheckAccessUseCase } from './check-access.use-case';

const mockPrisma = {
  user: { findUnique: vi.fn() },
  route: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  role: { findFirst: vi.fn() },
  roleRouteAccess: { findFirst: vi.fn() },
  userRouteAccess: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
};

const mockI18n = { t: vi.fn((k: string) => k) };
const mockLogging = { create: vi.fn() };
const mockPayloadRepo = { findByEmail: vi.fn(), updateById: vi.fn() };
const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn(),
  del: vi.fn(),
};
const mockRouteCeilings = { allowedRolesFor: vi.fn().mockReturnValue([]) };

const base = {
  page: 1,
  limit: 10,
  pagination: false,
  search: undefined,
  filter: undefined,
};
const paged = { ...base, pagination: true };

const fakeUser = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  status: 'ACTIVE',
  roleId: 'role1',
};
const fakeRoute = {
  id: 'r1',
  path: '/home',
  labelKey: 'home',
  labelKeyFormat: null,
};
const cmsRoute = {
  id: 'r2',
  path: '/cms',
  labelKey: 'cms',
  labelKeyFormat: null,
};

const accessRow = {
  id: 'a1',
  userId: 'u1',
  routeId: 'r1',
  grantedBy: 'admin',
  denied: false,
  createdAt: new Date('2024-01-01'),
  user: { id: 'u1', email: 'user@example.com', name: 'User' },
  route: { id: 'r1', path: '/home', labelKey: 'home' },
  grantedByUser: { id: 'admin', email: 'admin@example.com', name: 'Admin' },
};

describe('user-route-access use-cases', () => {
  let service: {
    findAll: FindAllUserRouteAccessUseCase['execute'];
    findAllByOne: FindAllByOneUseCase['execute'];
    grant: GrantAccessUseCase['execute'];
    revoke: RevokeAccessUseCase['execute'];
    revokeAll: RevokeAllAccessUseCase['execute'];
    findAllRoutesWithUserAccess: FindAllRoutesWithUserAccessUseCase['execute'];
    checkAccess: CheckAccessUseCase['execute'];
  };

  beforeEach(() => {
    const prisma = mockPrisma as unknown as PrismaService;
    const i18n = mockI18n as unknown as I18nService;
    const logging = mockLogging as unknown as LoggingService;
    const payload = mockPayloadRepo as unknown as PayloadUserRepository;
    const redis = mockRedis as unknown as RedisService;
    const routeCeilings = mockRouteCeilings as unknown as RouteCeilingRegistry;

    const findAll = new FindAllUserRouteAccessUseCase(prisma);
    const findAllByOne = new FindAllByOneUseCase(prisma, i18n, redis);
    const grant = new GrantAccessUseCase(prisma, i18n, logging, payload, redis, routeCeilings);
    const revoke = new RevokeAccessUseCase(prisma, i18n, logging, payload, redis);
    const revokeAll = new RevokeAllAccessUseCase(prisma, i18n, logging, payload, redis);
    const routesWithAccess = new FindAllRoutesWithUserAccessUseCase(
      prisma,
      i18n,
      routeCeilings,
    );
    const checkAccess = new CheckAccessUseCase(prisma);

    service = {
      findAll: findAll.execute.bind(findAll),
      findAllByOne: findAllByOne.execute.bind(findAllByOne),
      grant: grant.execute.bind(grant),
      revoke: revoke.execute.bind(revoke),
      revokeAll: revokeAll.execute.bind(revokeAll),
      findAllRoutesWithUserAccess: routesWithAccess.execute.bind(routesWithAccess),
      checkAccess: checkAccess.execute.bind(checkAccess),
    };
  });

  afterEach(() => vi.clearAllMocks());

  // ─── findAll ──────────────────────────────────────────────────────────────

  it('findAll returns list without pagination', async () => {
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([accessRow]);
    const result = await service.findAll(base);
    expect(Array.isArray(result)).toBe(true);
  });

  it('findAll returns list without pagination with null route (covers undefined branch)', async () => {
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([
      { ...accessRow, route: null },
    ]);
    const result = await service.findAll(base);
    expect((result as any[])[0].route).toBeUndefined();
  });

  it('findAll returns paginated response', async () => {
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([accessRow]);
    mockPrisma.userRouteAccess.count.mockResolvedValue(1);
    const result = await service.findAll(paged);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
  });

  it('findAll returns paginated response with null route (covers undefined branch)', async () => {
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([
      { ...accessRow, route: null },
    ]);
    mockPrisma.userRouteAccess.count.mockResolvedValue(1);
    const result = await service.findAll(paged);
    expect((result as any).data[0].route).toBeUndefined();
  });

  it('findAll with search uses filter', async () => {
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([]);
    await service.findAll({ ...base, search: 'home' });
    expect(mockPrisma.userRouteAccess.findMany).toHaveBeenCalled();
  });

  // ─── findAllByOne ─────────────────────────────────────────────────────────

  it('findAllByOne throws NotFoundException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findAllByOne('missing', base)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findAllByOne returns list without pagination', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([
      {
        ...accessRow,
        route: { id: 'r1', path: '/home', labelKey: 'home', isActive: true },
      },
    ]);
    const result = await service.findAllByOne('u1', base);
    expect(Array.isArray(result)).toBe(true);
  });

  it('findAllByOne returns list without pagination with null route', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([
      { ...accessRow, route: null },
    ]);
    const result = await service.findAllByOne('u1', base);
    expect((result as any[])[0].route).toBeUndefined();
  });

  it('findAllByOne returns paginated response', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([
      {
        ...accessRow,
        route: { id: 'r1', path: '/home', labelKey: 'home', isActive: true },
      },
    ]);
    mockPrisma.userRouteAccess.count.mockResolvedValue(1);
    const result = await service.findAllByOne('u1', paged);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
  });

  it('findAllByOne returns paginated response with null route', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
    mockPrisma.userRouteAccess.findMany.mockResolvedValue([
      { ...accessRow, route: null },
    ]);
    mockPrisma.userRouteAccess.count.mockResolvedValue(1);
    const result = await service.findAllByOne('u1', paged);
    expect((result as any).data[0].route).toBeUndefined();
  });

  // ─── grant ────────────────────────────────────────────────────────────────

  it('grant throws NotFoundException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.grant({ userId: 'u1', routeId: 'r1' }, 'admin'),
    ).rejects.toThrow(NotFoundException);
  });

  it('grant throws NotFoundException when route not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
    mockPrisma.route.findUnique.mockResolvedValue(null);
    await expect(
      service.grant({ userId: 'u1', routeId: 'r1' }, 'admin'),
    ).rejects.toThrow(NotFoundException);
  });

  it('grant throws ForbiddenException when user role is outside the route ceiling', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...fakeUser,
      roleRecord: { id: 'role1', name: 'USER' },
    });
    mockPrisma.route.findUnique.mockResolvedValue(fakeRoute);
    mockRouteCeilings.allowedRolesFor.mockReturnValueOnce(['ADMIN', 'MODERATOR']);
    await expect(
      service.grant({ userId: 'u1', routeId: 'r1' }, 'admin'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('grant throws ConflictException when access already exists with denied=false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
    mockPrisma.route.findUnique.mockResolvedValue(fakeRoute);
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue({
      ...accessRow,
      denied: false,
    });
    await expect(
      service.grant({ userId: 'u1', routeId: 'r1' }, 'admin'),
    ).rejects.toThrow(ConflictException);
  });

  it('grant clears DENY override when existing row has denied=true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
    mockPrisma.route.findUnique.mockResolvedValue(fakeRoute);
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue({
      ...accessRow,
      denied: true,
    });
    mockPrisma.userRouteAccess.update.mockResolvedValue({
      ...accessRow,
      denied: false,
    });
    mockLogging.create.mockResolvedValue({});
    const result = await service.grant(
      { userId: 'u1', routeId: 'r1' },
      'admin',
    );
    expect(mockPrisma.userRouteAccess.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ denied: false }),
      }),
    );
    expect(result).toHaveProperty('userId', 'u1');
  });

  it('grant creates access for non-cms route', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
    mockPrisma.route.findUnique.mockResolvedValue(fakeRoute);
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue(null);
    mockPrisma.userRouteAccess.create.mockResolvedValue(accessRow);
    mockLogging.create.mockResolvedValue({});
    const result = await service.grant(
      { userId: 'u1', routeId: 'r1' },
      'admin',
    );
    expect(result).toHaveProperty('userId', 'u1');
  });

  it('grant returns access with undefined route when created access has null route', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
    mockPrisma.route.findUnique.mockResolvedValue(fakeRoute);
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue(null);
    mockPrisma.userRouteAccess.create.mockResolvedValue({
      ...accessRow,
      route: null,
    });
    mockLogging.create.mockResolvedValue({});
    const result = await service.grant(
      { userId: 'u1', routeId: 'r1' },
      'admin',
    );
    expect(result.route).toBeUndefined();
  });

  it('grant creates cms access and unlocks payloadUser when found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...fakeUser,
      status: 'ACTIVE',
    });
    mockPrisma.route.findUnique.mockResolvedValue(cmsRoute);
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue(null);
    const cmsAccess = {
      ...accessRow,
      routeId: 'r2',
      route: { id: 'r2', path: '/cms', labelKey: 'cms' },
    };
    mockPrisma.userRouteAccess.create.mockResolvedValue(cmsAccess);
    mockLogging.create.mockResolvedValue({});
    mockPayloadRepo.findByEmail.mockResolvedValue({
      id: 42,
      email: 'user@example.com',
    });
    mockPayloadRepo.updateById.mockResolvedValue({});
    const result = await service.grant(
      { userId: 'u1', routeId: 'r2' },
      'admin',
    );
    expect(mockPayloadRepo.updateById).toHaveBeenCalledWith(42, {
      lockUntil: null,
      loginAttempts: 0,
    });
    expect(result).toHaveProperty('routeId', 'r2');
  });

  it('grant creates cms access and skips payloadUser when not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...fakeUser,
      status: 'ACTIVE',
    });
    mockPrisma.route.findUnique.mockResolvedValue(cmsRoute);
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue(null);
    const cmsAccess = {
      ...accessRow,
      routeId: 'r2',
      route: { id: 'r2', path: '/cms', labelKey: 'cms' },
    };
    mockPrisma.userRouteAccess.create.mockResolvedValue(cmsAccess);
    mockLogging.create.mockResolvedValue({});
    mockPayloadRepo.findByEmail.mockResolvedValue(null);
    const result = await service.grant(
      { userId: 'u1', routeId: 'r2' },
      'admin',
    );
    expect(mockPayloadRepo.updateById).not.toHaveBeenCalled();
    expect(result).toHaveProperty('routeId', 'r2');
  });

  it('grant creates cms access but does not unlock payloadUser when user is not ACTIVE', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...fakeUser,
      status: 'INACTIVE',
    });
    mockPrisma.route.findUnique.mockResolvedValue(cmsRoute);
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue(null);
    const cmsAccess = {
      ...accessRow,
      routeId: 'r2',
      route: { id: 'r2', path: '/cms', labelKey: 'cms' },
    };
    mockPrisma.userRouteAccess.create.mockResolvedValue(cmsAccess);
    mockLogging.create.mockResolvedValue({});
    await service.grant({ userId: 'u1', routeId: 'r2' }, 'admin');
    expect(mockPayloadRepo.findByEmail).not.toHaveBeenCalled();
  });

  // ─── revoke ───────────────────────────────────────────────────────────────

  it('revoke throws NotFoundException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.route.findUnique.mockResolvedValue(fakeRoute);
    await expect(service.revoke('u1', 'r1', 'admin')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('revoke throws NotFoundException when route not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@example.com' });
    mockPrisma.route.findUnique.mockResolvedValue(null);
    await expect(service.revoke('u1', 'r1', 'admin')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('revoke updates existing ALLOW row to DENY', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@example.com' });
    mockPrisma.route.findUnique.mockResolvedValue({
      id: 'r1',
      path: '/home',
      labelKey: 'home',
    });
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue({
      ...accessRow,
      denied: false,
    });
    mockPrisma.userRouteAccess.update.mockResolvedValue({});
    mockLogging.create.mockResolvedValue({});
    const result = await service.revoke('u1', 'r1', 'admin');
    expect(mockPrisma.userRouteAccess.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { denied: true } }),
    );
    expect(result).toHaveProperty('message');
  });

  it('revoke creates DENY row when no individual access exists (role-inherited route)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@example.com' });
    mockPrisma.route.findUnique.mockResolvedValue({
      id: 'r1',
      path: '/home',
      labelKey: 'home',
    });
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue(null);
    mockPrisma.userRouteAccess.create.mockResolvedValue({});
    mockLogging.create.mockResolvedValue({});
    const result = await service.revoke('u1', 'r1', 'admin');
    expect(mockPrisma.userRouteAccess.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ denied: true }),
      }),
    );
    expect(result).toHaveProperty('message');
  });

  it('revoke is idempotent when row already has denied=true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@example.com' });
    mockPrisma.route.findUnique.mockResolvedValue({
      id: 'r1',
      path: '/home',
      labelKey: 'home',
    });
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue({
      ...accessRow,
      denied: true,
    });
    const result = await service.revoke('u1', 'r1', 'admin');
    expect(mockPrisma.userRouteAccess.update).not.toHaveBeenCalled();
    expect(mockPrisma.userRouteAccess.create).not.toHaveBeenCalled();
    expect(result).toHaveProperty('message');
  });

  it('revoke cms access locks payloadUser when found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@example.com' });
    mockPrisma.route.findUnique.mockResolvedValue({
      id: 'r2',
      path: '/cms',
      labelKey: 'cms',
    });
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue({
      ...accessRow,
      denied: false,
    });
    mockPrisma.userRouteAccess.update.mockResolvedValue({});
    mockLogging.create.mockResolvedValue({});
    mockPayloadRepo.findByEmail.mockResolvedValue({ id: 42 });
    mockPayloadRepo.updateById.mockResolvedValue({});
    await service.revoke('u1', 'r2', 'admin');
    expect(mockPayloadRepo.updateById).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ lockUntil: expect.any(Date) }),
    );
  });

  it('revoke cms access skips payloadUser lock when not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@example.com' });
    mockPrisma.route.findUnique.mockResolvedValue({
      id: 'r2',
      path: '/cms',
      labelKey: 'cms',
    });
    mockPrisma.userRouteAccess.findUnique.mockResolvedValue({
      ...accessRow,
      denied: false,
    });
    mockPrisma.userRouteAccess.update.mockResolvedValue({});
    mockLogging.create.mockResolvedValue({});
    mockPayloadRepo.findByEmail.mockResolvedValue(null);
    const result = await service.revoke('u1', 'r2', 'admin');
    expect(mockPayloadRepo.updateById).not.toHaveBeenCalled();
    expect(result).toHaveProperty('message');
  });

  // ─── revokeAll ────────────────────────────────────────────────────────────

  it('revokeAll throws NotFoundException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.revokeAll('u1', 'admin')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('revokeAll deletes all accesses and returns count', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...fakeUser,
      userRouteAccesses: [
        { id: 'a1', denied: false, route: { path: '/home', labelKey: 'home' } },
      ],
    });
    mockPrisma.userRouteAccess.deleteMany.mockResolvedValue({ count: 1 });
    mockLogging.create.mockResolvedValue({});
    const result = await service.revokeAll('u1', 'admin');
    expect(result).toHaveProperty('count', 1);
    expect(result).toHaveProperty('message');
    expect(mockPrisma.userRouteAccess.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });

  it('revokeAll with /cms ALLOW route locks payloadUser when found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...fakeUser,
      userRouteAccesses: [
        { id: 'a1', denied: false, route: { path: '/cms', labelKey: 'cms' } },
      ],
    });
    mockPrisma.userRouteAccess.deleteMany.mockResolvedValue({ count: 1 });
    mockPayloadRepo.findByEmail.mockResolvedValue({
      id: 42,
      email: 'user@example.com',
    });
    mockPayloadRepo.updateById.mockResolvedValue({});
    mockLogging.create.mockResolvedValue({});
    const result = await service.revokeAll('u1', 'admin');
    expect(mockPayloadRepo.updateById).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ lockUntil: expect.any(Date) }),
    );
    expect(result).toHaveProperty('count', 1);
  });

  it('revokeAll with /cms DENY row does NOT lock payloadUser', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...fakeUser,
      userRouteAccesses: [
        { id: 'a1', denied: true, route: { path: '/cms', labelKey: 'cms' } },
      ],
    });
    mockPrisma.userRouteAccess.deleteMany.mockResolvedValue({ count: 1 });
    mockLogging.create.mockResolvedValue({});
    const result = await service.revokeAll('u1', 'admin');
    expect(mockPayloadRepo.findByEmail).not.toHaveBeenCalled();
    expect(result).toHaveProperty('count', 1);
  });

  it('revokeAll with /cms route skips lock when payloadUser not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...fakeUser,
      userRouteAccesses: [
        { id: 'a1', denied: false, route: { path: '/cms', labelKey: 'cms' } },
      ],
    });
    mockPrisma.userRouteAccess.deleteMany.mockResolvedValue({ count: 1 });
    mockPayloadRepo.findByEmail.mockResolvedValue(null);
    mockLogging.create.mockResolvedValue({});
    const result = await service.revokeAll('u1', 'admin');
    expect(mockPayloadRepo.updateById).not.toHaveBeenCalled();
    expect(result).toHaveProperty('count', 1);
  });

  // ─── findAllRoutesWithUserAccess ──────────────────────────────────────────

  const fakeRouteRow = {
    id: 'r1',
    path: '/home',
    labelKey: 'home',
    icon: null,
    isActive: true,
    userRouteAccesses: [
      {
        id: 'a1',
        grantedBy: 'admin',
        denied: false,
        createdAt: new Date('2024-01-01'),
      },
    ],
    roleRouteAccesses: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  it('findAllRoutesWithUserAccess throws NotFoundException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const query = { page: 1, limit: 10, pagination: false, search: undefined };
    await expect(
      service.findAllRoutesWithUserAccess('u1', query as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('findAllRoutesWithUserAccess returns list without pagination', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([fakeRouteRow]);
    const query = { page: 1, limit: 10, pagination: false, search: undefined };
    const result = await service.findAllRoutesWithUserAccess(
      'u1',
      query as any,
    );
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[])[0]).toHaveProperty('hasAccess', true);
    expect((result as any[])[0]).toHaveProperty('denied', false);
    expect((result as any[])[0]).toHaveProperty('fromRole', false);
  });

  it('findAllRoutesWithUserAccess returns hasAccess=true when route comes from role (no individual row)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([
      {
        ...fakeRouteRow,
        userRouteAccesses: [],
        roleRouteAccesses: [{ roleId: 'role1' }],
      },
    ]);
    const query = { page: 1, limit: 10, pagination: false, search: undefined };
    const result = await service.findAllRoutesWithUserAccess(
      'u1',
      query as any,
    );
    expect((result as any[])[0]).toHaveProperty('hasAccess', true);
    expect((result as any[])[0]).toHaveProperty('fromRole', true);
  });

  it('findAllRoutesWithUserAccess returns hasAccess=false when DENY overrides role access', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([
      {
        ...fakeRouteRow,
        userRouteAccesses: [
          { id: 'a1', grantedBy: 'admin', denied: true, createdAt: new Date() },
        ],
        roleRouteAccesses: [{ roleId: 'role1' }],
      },
    ]);
    const query = { page: 1, limit: 10, pagination: false, search: undefined };
    const result = await service.findAllRoutesWithUserAccess(
      'u1',
      query as any,
    );
    expect((result as any[])[0]).toHaveProperty('hasAccess', false);
    expect((result as any[])[0]).toHaveProperty('denied', true);
    expect((result as any[])[0]).toHaveProperty('fromRole', true);
  });

  it('findAllRoutesWithUserAccess non-paginated returns null accessInfo when no access', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([
      { ...fakeRouteRow, userRouteAccesses: [], roleRouteAccesses: [] },
    ]);
    const query = { page: 1, limit: 10, pagination: false, search: undefined };
    const result = await service.findAllRoutesWithUserAccess(
      'u1',
      query as any,
    );
    expect((result as any[])[0].accessInfo).toBeNull();
    expect((result as any[])[0].hasAccess).toBe(false);
  });

  it('findAllRoutesWithUserAccess returns list with search filter', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([]);
    const query = { page: 1, limit: 10, pagination: false, search: 'home' };
    await service.findAllRoutesWithUserAccess('u1', query as any);
    expect(mockPrisma.route.findMany).toHaveBeenCalled();
  });

  it('findAllRoutesWithUserAccess returns paginated response', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([fakeRouteRow]);
    mockPrisma.route.count.mockResolvedValue(1);
    const query = { page: 1, limit: 10, pagination: true, search: undefined };
    const result = await service.findAllRoutesWithUserAccess(
      'u1',
      query as any,
    );
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
  });

  it('findAllRoutesWithUserAccess paginated returns null accessInfo when no access', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([
      { ...fakeRouteRow, userRouteAccesses: [], roleRouteAccesses: [] },
    ]);
    mockPrisma.route.count.mockResolvedValue(1);
    const query = { page: 1, limit: 10, pagination: true, search: undefined };
    const result = await service.findAllRoutesWithUserAccess(
      'u1',
      query as any,
    );
    expect((result as any).data[0].accessInfo).toBeNull();
  });

  it('findAllRoutesWithUserAccess filtra rotas pelo teto do RouteCeilingRegistry', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      roleId: 'role1',
      roleRecord: { name: 'USER' },
    });
    mockPrisma.route.findMany.mockResolvedValue([
      { ...fakeRouteRow, id: 'r1', path: '/allowed' },
      { ...fakeRouteRow, id: 'r2', path: '/blocked' },
    ]);
    mockRouteCeilings.allowedRolesFor.mockImplementation((path: string) =>
      path === '/blocked' ? ['ADMIN'] : [],
    );
    const query = { page: 1, limit: 10, pagination: false, search: undefined };
    const result = (await service.findAllRoutesWithUserAccess(
      'u1',
      query as any,
    )) as unknown as Array<{ path: string }>;
    expect(result.map((r) => r.path)).toEqual(['/allowed']);
    mockRouteCeilings.allowedRolesFor.mockReturnValue([]);
  });

  // ─── checkAccess ──────────────────────────────────────────────────────────

  it('checkAccess returns false for empty path', async () => {
    expect(await service.checkAccess('u1', '')).toBe(false);
    expect(await service.checkAccess('u1', '   ')).toBe(false);
  });

  it('checkAccess returns false when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await service.checkAccess('u1', '/home')).toBe(false);
  });

  it('checkAccess consulta do path mais específico ao mais genérico', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([]);
    expect(await service.checkAccess('u1', '/home/123')).toBe(false);
    expect(mockPrisma.route.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { path: { in: ['/home/123', '/home'] } } }),
    );
  });

  it('checkAccess: subrota cadastrada decide sozinha, sem herdar o pai', async () => {
    mockPrisma.route.findMany.mockResolvedValue([
      {
        id: 'r1',
        path: '/settings',
        isActive: true,
        userRouteAccesses: [],
        roleRouteAccesses: [{ roleId: 'role1' }],
      },
      {
        id: 'r2',
        path: '/settings/feature-flags',
        isActive: true,
        userRouteAccesses: [],
        roleRouteAccesses: [],
      },
    ]);
    expect(
      await service.checkAccess('u1', '/settings/feature-flags', 'role1'),
    ).toBe(false);
    expect(await service.checkAccess('u1', '/settings', 'role1')).toBe(true);
  });

  it('checkAccess: segmento dinâmico cai no ancestral cadastrado', async () => {
    mockPrisma.route.findMany.mockResolvedValue([
      {
        id: 'r1',
        path: '/user',
        isActive: true,
        userRouteAccesses: [],
        roleRouteAccesses: [{ roleId: 'role1' }],
      },
    ]);
    expect(
      await service.checkAccess('u1', '/user/0f8fad5b-d9cb-469f-a165-70867728950e', 'role1'),
    ).toBe(true);
  });

  it('checkAccess returns false when route is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([{
      id: 'r1',
      path: '/home',
      isActive: false,
      userRouteAccesses: [],
      roleRouteAccesses: [],
    }]);
    expect(await service.checkAccess('u1', '/home')).toBe(false);
  });

  it('checkAccess returns false when neither individual nor role access exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([{
      id: 'r1',
      path: '/home',
      isActive: true,
      userRouteAccesses: [],
      roleRouteAccesses: [],
    }]);
    expect(await service.checkAccess('u1', '/home')).toBe(false);
  });

  it('checkAccess returns true when user has role access (no individual access)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([{
      id: 'r1',
      path: '/home',
      isActive: true,
      userRouteAccesses: [],
      roleRouteAccesses: [{ roleId: 'role1' }],
    }]);
    expect(await service.checkAccess('u1', '/home')).toBe(true);
  });

  it('checkAccess returns true when user has individual ALLOW access', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([{
      id: 'r1',
      path: '/home',
      isActive: true,
      userRouteAccesses: [{ id: 'a1', denied: false }],
      roleRouteAccesses: [],
    }]);
    expect(await service.checkAccess('u1', '/home')).toBe(true);
  });

  it('checkAccess returns false when user has DENY override even though role has access', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([{
      id: 'r1',
      path: '/home',
      isActive: true,
      userRouteAccesses: [{ id: 'a1', denied: true }],
      roleRouteAccesses: [{ roleId: 'role1' }],
    }]);
    expect(await service.checkAccess('u1', '/home')).toBe(false);
  });

  it('checkAccess handles path without leading slash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ roleId: 'role1' });
    mockPrisma.route.findMany.mockResolvedValue([]);
    expect(await service.checkAccess('u1', 'home')).toBe(false);
  });
});
