import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

const mockPrisma = {
  user: { findUnique: vi.fn() },
} as unknown as PrismaService;
const mockI18n = { t: vi.fn((k: string) => k) } as unknown as I18nService;

function makeStrategy(secret = 'test-secret') {
  const mockConfig = {
    get: vi.fn((key: string) => (key === 'JWT_SECRET' ? secret : undefined)),
  };
  return new JwtStrategy(mockConfig as any, mockPrisma, mockI18n);
}

describe('JwtStrategy', () => {
  afterEach(() => vi.clearAllMocks());

  it('lança no boot quando JWT_SECRET não está definido', () => {
    const mockConfig = { get: vi.fn().mockReturnValue(undefined) };
    expect(
      () => new JwtStrategy(mockConfig as any, mockPrisma, mockI18n),
    ).toThrow('JWT_SECRET must be set');
  });

  describe('validate', () => {
    const payload = {
      sub: 'user-id',
      email: 'a@b.com',
      roleId: 'role-uuid',
      roleName: 'USER',
    };

    const activeUser = {
      id: 'user-id',
      email: 'a@b.com',
      role: 'USER',
      status: 'ACTIVE',
      deletedAt: null,
      roleId: 'role-uuid',
      roleRecord: { name: 'USER' },
    };

    it('retorna AuthenticatedUser com roleName do DB', async () => {
      const strategy = makeStrategy();
      (
        mockPrisma.user.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(activeUser);
      const result = await strategy.validate(payload);
      expect(result).toMatchObject({
        id: 'user-id',
        email: 'a@b.com',
        roleName: 'USER',
      });
    });

    it('roleName vem do DB — payload espoofado com roleName ADMIN não eleva privilégio', async () => {
      const strategy = makeStrategy();
      (
        mockPrisma.user.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        ...activeUser,
        role: 'USER',
        roleRecord: { name: 'USER' },
      });
      const spoofedPayload = { ...payload, roleName: 'ADMIN' };
      const result = await strategy.validate(spoofedPayload);
      expect(result.roleName).toBe('USER');
    });

    it('rejeita usuário não encontrado', async () => {
      const strategy = makeStrategy();
      (
        mockPrisma.user.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejeita usuário soft-deletado (deletedAt != null)', async () => {
      const strategy = makeStrategy();
      (
        mockPrisma.user.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        ...activeUser,
        deletedAt: new Date(),
      });
      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejeita usuário inativo (status != ACTIVE)', async () => {
      const strategy = makeStrategy();
      (
        mockPrisma.user.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        ...activeUser,
        status: 'INACTIVE',
      });
      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
