import { Test, TestingModule } from '@nestjs/testing';
import { PayloadUserRepository } from './payload-user.repository';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPrisma = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
};

describe('PayloadUserRepository', () => {
  let repo: PayloadUserRepository;

  const fakeUser = {
    id: 1,
    email: 'test@example.com',
    hash: 'hash',
    salt: 'salt',
    loginAttempts: 0,
    lockUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    resetPasswordToken: null,
    resetPasswordExpiration: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayloadUserRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get<PayloadUserRepository>(PayloadUserRepository);
  });

  afterEach(() => vi.clearAllMocks());

  // ─── tableExists ──────────────────────────────────────────────

  it('tableExists returns true when table exists', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ exists: true }]);
    await expect(repo.tableExists()).resolves.toBe(true);
  });

  it('tableExists returns false when exists is false', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ exists: false }]);
    await expect(repo.tableExists()).resolves.toBe(false);
  });

  it('tableExists returns false when result array is empty', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await expect(repo.tableExists()).resolves.toBe(false);
  });

  it('tableExists swallows errors and returns false', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('db error'));
    await expect(repo.tableExists()).resolves.toBe(false);
  });

  // ─── findByEmail ──────────────────────────────────────────────

  it('findByEmail returns the row when found', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(repo.findByEmail('test@example.com')).resolves.toEqual(
      fakeUser,
    );
  });

  it('findByEmail returns null when not found', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await expect(repo.findByEmail('missing@example.com')).resolves.toBeNull();
  });

  // ─── findById ─────────────────────────────────────────────────

  it('findById returns the row when found', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(repo.findById(1)).resolves.toEqual(fakeUser);
  });

  it('findById returns null when not found', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await expect(repo.findById(999)).resolves.toBeNull();
  });

  // ─── findMany ─────────────────────────────────────────────────

  it('findMany without options returns all rows', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(repo.findMany()).resolves.toEqual([fakeUser]);
  });

  it('findMany with search uses ILIKE pattern', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(repo.findMany({ search: 'test' })).resolves.toEqual([
      fakeUser,
    ]);
  });

  // ─── count ────────────────────────────────────────────────────

  it('count without search returns total', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(5) }]);
    await expect(repo.count()).resolves.toBe(5);
  });

  it('count with search returns filtered total', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(2) }]);
    await expect(repo.count('test')).resolves.toBe(2);
  });

  it('count returns 0 when result array is empty', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await expect(repo.count()).resolves.toBe(0);
  });

  it('count with search returns 0 when result array is empty', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await expect(repo.count('notfound')).resolves.toBe(0);
  });

  // ─── create ───────────────────────────────────────────────────

  it('create inserts and returns the new row', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(repo.create({ email: 'new@example.com' })).resolves.toEqual(
      fakeUser,
    );
  });

  // ─── updateById ───────────────────────────────────────────────

  it('updateById with empty data delegates to findById (early return)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(repo.updateById(1, {})).resolves.toEqual(fakeUser);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('updateById with data executes UPDATE query', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(repo.updateById(1, { loginAttempts: 0 })).resolves.toEqual(
      fakeUser,
    );
  });

  it('updateById silently skips unknown keys not in columnMap', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    // 'unknownField' is not in the column map — should be skipped, not throw
    await expect(
      repo.updateById(1, { loginAttempts: 0, unknownField: 'ignored' } as any),
    ).resolves.toEqual(fakeUser);
  });

  it('updateById maps undefined value to null in SQL fragment', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    // loginAttempts is a valid key but its value is undefined — covers the ternary null branch
    await expect(
      repo.updateById(1, { loginAttempts: undefined } as any),
    ).resolves.toEqual(fakeUser);
  });

  // ─── updateByEmail ────────────────────────────────────────────

  it('updateByEmail with empty data delegates to findByEmail (early return)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(repo.updateByEmail('test@example.com', {})).resolves.toEqual(
      fakeUser,
    );
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('updateByEmail with data executes UPDATE query', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(
      repo.updateByEmail('test@example.com', { loginAttempts: 0 }),
    ).resolves.toEqual(fakeUser);
  });

  // ─── delete ───────────────────────────────────────────────────

  it('delete calls $executeRaw and returns void', async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1);
    await expect(repo.delete(1)).resolves.toBeUndefined();
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  // ─── upsertByEmail ────────────────────────────────────────────

  it('upsertByEmail returns new row when insert succeeds', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([fakeUser]);
    await expect(
      repo.upsertByEmail({ email: 'test@example.com' }),
    ).resolves.toEqual(fakeUser);
  });

  it('upsertByEmail falls back to findByEmail when conflict (ON CONFLICT DO NOTHING returns [])', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([]) // INSERT returns nothing (conflict)
      .mockResolvedValueOnce([fakeUser]); // findByEmail fallback
    await expect(
      repo.upsertByEmail({ email: 'test@example.com' }),
    ).resolves.toEqual(fakeUser);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
