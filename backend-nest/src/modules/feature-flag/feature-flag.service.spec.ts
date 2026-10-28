import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/infrastructure/redis/redis.service';

const adminRoleId = 'role-admin-id';
const userRoleId = 'role-user-id';

const mockRedis = {
  get: vi.fn().mockResolvedValue(null), // cache miss by default
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
};

const mockI18n = { t: (k: string) => k };

const mockPrisma = {
  featureFlag: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  featureFlagRole: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  role: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (ops: unknown[]) => {
    for (const op of ops) await op;
  }),
};

// Helpers to build flag fixtures
function makeFlag(
  overrides: Partial<{
    id: string;
    key: string;
    enabled: boolean;
    parentId: string | null;
    roles: { id: string; roleId: string; role: { name: string } }[];
  }> = {},
) {
  return {
    id: 'flag-1',
    key: 'MY_FLAG',
    description: null,
    enabled: false,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [],
    ...overrides,
  };
}

describe('FeatureFlagService — avaliação semântica', () => {
  let service: FeatureFlagService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    service = module.get<FeatureFlagService>(FeatureFlagService);
  });

  afterEach(() => vi.clearAllMocks());

  // Linha 1: enabled=false → OFF para todos (kill-switch)
  it('enabled=false → false para qualquer role', async () => {
    const flag = makeFlag({ enabled: false, roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([flag]);
    mockPrisma.role.findUnique.mockResolvedValue({ id: adminRoleId });

    const result = await service.evaluateForRole('ADMIN');
    expect(result['MY_FLAG']).toBe(false);
  });

  // Linha 2: enabled=true, sem roles → ON para todas as roles
  it('enabled=true, sem roles → true para qualquer role', async () => {
    const flag = makeFlag({ enabled: true, roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([flag]);
    mockPrisma.role.findUnique.mockResolvedValue({ id: userRoleId });

    const result = await service.evaluateForRole('USER');
    expect(result['MY_FLAG']).toBe(true);
  });

  // Linha 3: enabled=true, roles=[ADMIN] → ON só para ADMIN
  it('enabled=true, allowlist=[ADMIN] → true para ADMIN, false para USER', async () => {
    const flag = makeFlag({
      enabled: true,
      roles: [{ id: 'ffr-1', roleId: adminRoleId, role: { name: 'ADMIN' } }],
    });
    mockPrisma.featureFlag.findMany.mockResolvedValue([flag]);

    // ADMIN call
    mockPrisma.role.findUnique.mockResolvedValueOnce({ id: adminRoleId });
    const adminResult = await service.evaluateForRole('ADMIN');
    expect(adminResult['MY_FLAG']).toBe(true);

    // USER call — reset cache miss
    mockRedis.get.mockResolvedValueOnce(null);
    mockPrisma.featureFlag.findMany.mockResolvedValueOnce([flag]);
    mockPrisma.role.findUnique.mockResolvedValueOnce({ id: userRoleId });
    const userResult = await service.evaluateForRole('USER');
    expect(userResult['MY_FLAG']).toBe(false);
  });

  // A allowlist casa por role.name vindo do payload cacheado. Se alguém voltar a
  // resolver o roleId no banco, volta uma query por request gateada.
  it('avaliar não consulta a tabela Role', async () => {
    const flag = makeFlag({
      enabled: true,
      roles: [{ id: 'ffr-1', roleId: adminRoleId, role: { name: 'ADMIN' } }],
    });
    mockPrisma.featureFlag.findMany.mockResolvedValue([flag]);

    expect(await service.isEnabled('MY_FLAG', 'ADMIN')).toBe(true);
    expect(mockPrisma.role.findUnique).not.toHaveBeenCalled();
  });

  // Cache: hit evita DB
  it('usa cache quando disponível', async () => {
    const flag = makeFlag({ enabled: true });
    mockRedis.get.mockResolvedValueOnce(JSON.stringify([flag]));
    mockPrisma.role.findUnique.mockResolvedValue({ id: userRoleId });

    await service.evaluateForRole('USER');
    expect(mockPrisma.featureFlag.findMany).not.toHaveBeenCalled();
  });

  // isEnabled — flag missing → false
  it('isEnabled — chave inexistente → false', async () => {
    mockPrisma.featureFlag.findMany.mockResolvedValue([]);
    mockPrisma.role.findUnique.mockResolvedValue(null);

    const result = await service.isEnabled('NONEXISTENT', 'USER');
    expect(result).toBe(false);
  });

  it('invalidate derruba o cache — use-cases de escrita chamam isso após gravar', async () => {
    await service.invalidate();
    expect(mockRedis.del).toHaveBeenCalledWith('feature-flags:all');
  });

  it('findAll expõe a mesma lista cacheada usada na avaliação', async () => {
    const flag = makeFlag({ enabled: true });
    mockPrisma.featureFlag.findMany.mockResolvedValue([flag]);

    const result = await service.findAll();
    expect(result).toEqual([flag]);
  });

  it('cache corrompido cai no banco em vez de estourar', async () => {
    mockRedis.get.mockResolvedValueOnce('{not json');
    const flag = makeFlag({ enabled: true });
    mockPrisma.featureFlag.findMany.mockResolvedValue([flag]);

    const result = await service.findAll();
    expect(result).toEqual([flag]);
    expect(mockPrisma.featureFlag.findMany).toHaveBeenCalled();
  });
});

describe('FeatureFlagService — cascata de flag filha (parentId)', () => {
  let service: FeatureFlagService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    service = module.get<FeatureFlagService>(FeatureFlagService);
  });

  // Pai ON e filha ON → filha avalia ON
  it('pai ON, filha ON → filha true', async () => {
    const parent = makeFlag({ id: 'p', key: 'PARENT', enabled: true, roles: [] });
    const child = makeFlag({ id: 'c', key: 'CHILD', enabled: true, parentId: 'p', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([parent, child]);

    expect(await service.isEnabled('CHILD', 'USER')).toBe(true);
  });

  // Pai OFF derruba a filha mesmo com a filha ON — o caso que motivou a feature
  it('pai OFF, filha ON → filha false (herda o kill-switch do pai)', async () => {
    const parent = makeFlag({ id: 'p', key: 'PARENT', enabled: false, roles: [] });
    const child = makeFlag({ id: 'c', key: 'CHILD', enabled: true, parentId: 'p', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([parent, child]);

    expect(await service.isEnabled('CHILD', 'USER')).toBe(false);
  });

  // 3 níveis: avó → mãe → filha, todas ON
  it('avaliação sobe a cadeia inteira de parentId (netos)', async () => {
    const grandparent = makeFlag({ id: 'gp', key: 'GP', enabled: true, roles: [] });
    const parent = makeFlag({ id: 'p', key: 'P', enabled: true, parentId: 'gp', roles: [] });
    const child = makeFlag({ id: 'c', key: 'C', enabled: true, parentId: 'p', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([grandparent, parent, child]);

    expect(await service.isEnabled('C', 'USER')).toBe(true);
  });

  // Avó desligada no meio da cadeia derruba a neta
  it('avó OFF derruba a neta mesmo com mãe e neta ON', async () => {
    const grandparent = makeFlag({ id: 'gp', key: 'GP', enabled: false, roles: [] });
    const parent = makeFlag({ id: 'p', key: 'P', enabled: true, parentId: 'gp', roles: [] });
    const child = makeFlag({ id: 'c', key: 'C', enabled: true, parentId: 'p', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([grandparent, parent, child]);

    expect(await service.isEnabled('C', 'USER')).toBe(false);
  });

  // parentId aponta pra um id que não existe mais na lista cacheada → nega (fail-closed)
  it('parentId órfão (pai sumiu do cache) → false', async () => {
    const child = makeFlag({ id: 'c', key: 'C', enabled: true, parentId: 'missing', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([child]);

    expect(await service.isEnabled('C', 'USER')).toBe(false);
  });

  // ── assertValidParent ──────────────────────────────────────────

  it('assertValidParent — sem parentId → não valida nada', async () => {
    await expect(service.assertValidParent('a', undefined)).resolves.toBeUndefined();
    await expect(service.assertValidParent('a', null)).resolves.toBeUndefined();
  });

  it('assertValidParent — auto-referência → ConflictException', async () => {
    await expect(service.assertValidParent('a', 'a')).rejects.toThrow(ConflictException);
  });

  it('assertValidParent — pai inexistente → NotFoundException', async () => {
    mockPrisma.featureFlag.findMany.mockResolvedValue([]);
    await expect(service.assertValidParent('a', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('assertValidParent — ciclo (pai proposto já é descendente da flag) → ConflictException', async () => {
    const a = makeFlag({ id: 'a', key: 'A', roles: [] });
    const b = makeFlag({ id: 'b', key: 'B', parentId: 'a', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([a, b]);

    // tentar setar A.parentId = B fecharia o ciclo A→B→A
    await expect(service.assertValidParent('a', 'b')).rejects.toThrow(ConflictException);
  });

  it('assertValidParent — profundidade dentro do limite (5) → ok', async () => {
    // cadeia n1→n2→n3→n4, propondo n5 como filha de n4 (profundidade final = 5)
    const n1 = makeFlag({ id: 'n1', key: 'N1', roles: [] });
    const n2 = makeFlag({ id: 'n2', key: 'N2', parentId: 'n1', roles: [] });
    const n3 = makeFlag({ id: 'n3', key: 'N3', parentId: 'n2', roles: [] });
    const n4 = makeFlag({ id: 'n4', key: 'N4', parentId: 'n3', roles: [] });
    const n5 = makeFlag({ id: 'n5', key: 'N5', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([n1, n2, n3, n4, n5]);

    await expect(service.assertValidParent('n5', 'n4')).resolves.toBeUndefined();
  });

  it('assertValidParent — profundidade acima do limite (5) → ConflictException', async () => {
    // n1→n2→n3→n4→n5, propondo n6 como filha de n5 (profundidade final = 6)
    const n1 = makeFlag({ id: 'n1', key: 'N1', roles: [] });
    const n2 = makeFlag({ id: 'n2', key: 'N2', parentId: 'n1', roles: [] });
    const n3 = makeFlag({ id: 'n3', key: 'N3', parentId: 'n2', roles: [] });
    const n4 = makeFlag({ id: 'n4', key: 'N4', parentId: 'n3', roles: [] });
    const n5 = makeFlag({ id: 'n5', key: 'N5', parentId: 'n4', roles: [] });
    const n6 = makeFlag({ id: 'n6', key: 'N6', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([n1, n2, n3, n4, n5, n6]);

    await expect(service.assertValidParent('n6', 'n5')).rejects.toThrow(ConflictException);
  });

  it('assertValidParent — cadeia de ancestrais corrompida (> MAX_DEPTH, sem ciclo) → ConflictException', async () => {
    // n1→n2→...→n7: 7 ancestrais numa corrente que nunca deveria existir pela API
    // (ela mesma limita a profundidade ao gravar) — só acontece por corrupção direta no banco.
    const n1 = makeFlag({ id: 'n1', key: 'N1', roles: [] });
    const n2 = makeFlag({ id: 'n2', key: 'N2', parentId: 'n1', roles: [] });
    const n3 = makeFlag({ id: 'n3', key: 'N3', parentId: 'n2', roles: [] });
    const n4 = makeFlag({ id: 'n4', key: 'N4', parentId: 'n3', roles: [] });
    const n5 = makeFlag({ id: 'n5', key: 'N5', parentId: 'n4', roles: [] });
    const n6 = makeFlag({ id: 'n6', key: 'N6', parentId: 'n5', roles: [] });
    const n7 = makeFlag({ id: 'n7', key: 'N7', parentId: 'n6', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([n1, n2, n3, n4, n5, n6, n7]);

    await expect(service.assertValidParent('zzz', 'n7')).rejects.toThrow(ConflictException);
  });

  it('assertValidParent — reparentar nó com subárvore própria conta a altura da subárvore', async () => {
    // D→E→F (3 níveis) já existe. A é raiz com subárvore própria A→B→C (altura 2).
    // Reparentar A sob F empurraria a subárvore inteira: A vira nível 4, B nível 5,
    // C nível 6 — estoura o teto de 5 mesmo sem nenhum ciclo envolvido.
    const d = makeFlag({ id: 'd', key: 'D', roles: [] });
    const e = makeFlag({ id: 'e', key: 'E', parentId: 'd', roles: [] });
    const f = makeFlag({ id: 'f', key: 'F', parentId: 'e', roles: [] });
    const a = makeFlag({ id: 'a', key: 'A', roles: [] });
    const b = makeFlag({ id: 'b', key: 'B', parentId: 'a', roles: [] });
    const c = makeFlag({ id: 'c', key: 'C', parentId: 'b', roles: [] });
    mockPrisma.featureFlag.findMany.mockResolvedValue([d, e, f, a, b, c]);

    await expect(service.assertValidParent('a', 'f')).rejects.toThrow(ConflictException);
  });
});
