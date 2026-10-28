import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ResetPasswordUseCase } from './reset-password.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import * as crypto from 'crypto';

const mockPrisma = {
  passwordResetToken: {
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  user: { update: vi.fn().mockResolvedValue({}) },
  refreshToken: { deleteMany: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn().mockResolvedValue([]),
};
const mockCrypto = {
  generatePasswordHash: vi.fn().mockResolvedValue({ hash: 'h', salt: 's' }),
};
const mockLogging = { create: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };

const validToken = 'raw-token-abc';
const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');
const resetRecord = {
  id: 'prt1',
  tokenHash,
  userId: 'u1',
  expiresAt: new Date(Date.now() + 60_000),
  usedAt: null,
  user: { id: 'u1', email: 'a@b.com' },
};

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ResetPasswordUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: LoggingService, useValue: mockLogging },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(ResetPasswordUseCase);
    vi.clearAllMocks();
    mockLogging.create.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockResolvedValue([]);
    mockCrypto.generatePasswordHash.mockResolvedValue({ hash: 'h', salt: 's' });
  });

  describe('validateResetToken', () => {
    it('retorna true para token válido não expirado', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(resetRecord);

      const result = await useCase.validateResetToken(validToken);
      expect(result).toBe(true);
    });

    it('retorna false quando token não existe', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

      const result = await useCase.validateResetToken('invalid');
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('redefine senha e invalida sessões existentes', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(resetRecord);

      await useCase.execute(validToken, 'NewPass1!');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockCrypto.generatePasswordHash).toHaveBeenCalledWith('NewPass1!');
    });

    it('lança BadRequestException para token inválido', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(useCase.execute('bad-token', 'NewPass1!')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
