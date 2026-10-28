import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import { FeatureFlagService } from '../feature-flag.service';
import { FindOneFeatureFlagUseCase } from './find-one.use-case';
import { CreateFeatureFlagUseCase } from './create.use-case';
import { UpdateFeatureFlagUseCase } from './update.use-case';
import { RemoveFeatureFlagUseCase } from './remove.use-case';
import { SetFeatureFlagRolesUseCase } from './set-roles.use-case';

/** CRUD das flags; o service entra real para valer a invalidação de cache. */

const adminRoleId = 'role-admin-id';

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  featureFlag: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  featureFlagRole: { deleteMany: vi.fn(), createMany: vi.fn() },
  role: { findUnique: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => {
    for (const op of ops) await op;
  }),
};

function makeFlag(overrides: Record<string, unknown> = {}) {
  return {
    id: 'flag-1',
    key: 'MY_FLAG',
    description: null,
    category: 'GENERAL' as const,
    isSystem: false,
    enabled: false,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [],
    ...overrides,
  };
}

describe('feature-flag use-cases', () => {
  let findOne: FindOneFeatureFlagUseCase;
  let create: CreateFeatureFlagUseCase;
  let update: UpdateFeatureFlagUseCase;
  let remove: RemoveFeatureFlagUseCase;
  let setRoles: SetFeatureFlagRolesUseCase;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        FindOneFeatureFlagUseCase,
        CreateFeatureFlagUseCase,
        UpdateFeatureFlagUseCase,
        RemoveFeatureFlagUseCase,
        SetFeatureFlagRolesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: I18nService, useValue: { t: (k: string) => k } },
      ],
    }).compile();

    findOne = module.get(FindOneFeatureFlagUseCase);
    create = module.get(CreateFeatureFlagUseCase);
    update = module.get(UpdateFeatureFlagUseCase);
    remove = module.get(RemoveFeatureFlagUseCase);
    setRoles = module.get(SetFeatureFlagRolesUseCase);
  });

  afterEach(() => vi.clearAllMocks());

  it('findOne — não encontrada → NotFoundException', async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
    await expect(findOne.execute('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('create — conflito → ConflictException', async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue(makeFlag());
    await expect(
      create.execute({ key: 'MY_FLAG', enabled: false, category: 'GENERAL', isSystem: false }),
    ).rejects.toThrow(ConflictException);
  });

  it('create — novo → invalida cache', async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
    mockPrisma.featureFlag.create.mockResolvedValue(makeFlag({ enabled: true }));

    await create.execute({ key: 'MY_FLAG', enabled: true, category: 'GENERAL', isSystem: false });
    expect(mockRedis.del).toHaveBeenCalledWith('feature-flags:all');
  });

  it('update — id inexistente → NotFoundException, sem escrever', async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
    await expect(update.execute('bad-id', { enabled: true })).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.featureFlag.update).not.toHaveBeenCalled();
  });

  it('update — invalida cache', async () => {
    const flag = makeFlag();
    mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);
    mockPrisma.featureFlag.update.mockResolvedValue(flag);

    await update.execute('flag-1', { enabled: true });
    expect(mockRedis.del).toHaveBeenCalledWith('feature-flags:all');
  });

  // ── parentId (sub feature flags) ─────────────────────────────

  it('create — parentId inexistente → NotFoundException, não cria', async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
    mockPrisma.featureFlag.findMany.mockResolvedValue([]);

    await expect(
      create.execute({ key: 'CHILD', enabled: true, category: 'GENERAL', isSystem: false, parentId: 'missing-parent' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.featureFlag.create).not.toHaveBeenCalled();
  });

  it('create — parentId válido → cria já vinculada à flag pai', async () => {
    const parent = makeFlag({ id: 'parent-1', key: 'PARENT' });
    mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
    mockPrisma.featureFlag.findMany.mockResolvedValue([parent]);
    mockPrisma.featureFlag.create.mockResolvedValue(
      makeFlag({ id: 'child-1', key: 'CHILD', parentId: 'parent-1' }),
    );

    await create.execute({ key: 'CHILD', enabled: true, category: 'GENERAL', isSystem: false, parentId: 'parent-1' });
    expect(mockPrisma.featureFlag.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentId: 'parent-1' }) }),
    );
  });

  it('update — parentId fecharia um ciclo → ConflictException, não escreve', async () => {
    const flag = makeFlag({ id: 'flag-1' });
    const child = makeFlag({ id: 'child-1', key: 'CHILD', parentId: 'flag-1' });
    mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);
    mockPrisma.featureFlag.findMany.mockResolvedValue([flag, child]);

    await expect(
      update.execute('flag-1', { parentId: 'child-1' }),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.featureFlag.update).not.toHaveBeenCalled();
  });

  it('update — parentId: null desvincula do pai (vira root)', async () => {
    const flag = makeFlag({ id: 'flag-1', parentId: 'parent-1' });
    mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);
    mockPrisma.featureFlag.update.mockResolvedValue({ ...flag, parentId: null });

    await update.execute('flag-1', { parentId: null });
    expect(mockPrisma.featureFlag.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentId: null }) }),
    );
  });

  it('remove — invalida cache', async () => {
    const flag = makeFlag();
    mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);
    mockPrisma.featureFlag.delete.mockResolvedValue(flag);

    await remove.execute('flag-1');
    expect(mockRedis.del).toHaveBeenCalledWith('feature-flags:all');
  });

  it('setRoles — invalida cache', async () => {
    const flag = makeFlag();
    mockPrisma.featureFlag.findUnique
      .mockResolvedValueOnce(flag)
      .mockResolvedValueOnce(flag);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await setRoles.execute('flag-1', [adminRoleId]);
    expect(mockRedis.del).toHaveBeenCalledWith('feature-flags:all');
  });

  it('setRoles — lista vazia não gera createMany', async () => {
    const flag = makeFlag();
    mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await setRoles.execute('flag-1', []);
    expect(mockPrisma.featureFlagRole.createMany).not.toHaveBeenCalled();
  });
});
