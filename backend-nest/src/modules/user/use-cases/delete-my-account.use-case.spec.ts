import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DeleteMyAccountUseCase } from './delete-my-account.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { LoggingService } from '../../logging/logging.service';

const mockPrisma = {
  user: { findFirst: vi.fn(), update: vi.fn() },
  refreshToken: { deleteMany: vi.fn() },
  passwordResetToken: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
};
const mockI18n = { t: vi.fn((k: string) => k) };
const mockCrypto = { verifyPassword: vi.fn() };
const mockLogging = { create: vi.fn() };

const user = {
  id: 'u1',
  email: 'a@b.com',
  hash: 'h',
  salt: 's',
  deletedAt: null,
};

describe('DeleteMyAccountUseCase', () => {
  let useCase: DeleteMyAccountUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        DeleteMyAccountUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: LoggingService, useValue: mockLogging },
      ],
    }).compile();
    useCase = mod.get(DeleteMyAccountUseCase);
    vi.clearAllMocks();
    mockLogging.create.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it('anonimiza conta quando senha correta', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(user);
    mockCrypto.verifyPassword.mockResolvedValue(true);

    await expect(useCase.execute('u1', 'correct')).resolves.toBeUndefined();
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  // phone é @unique no schema — não limpar na anonimização trava o número para sempre.
  it('limpa o phone na anonimização (campo @unique)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...user, phone: '+5511999998888' });
    mockCrypto.verifyPassword.mockResolvedValue(true);

    await useCase.execute('u1', 'correct');

    const userUpdateCall = mockPrisma.user.update.mock.calls[0]?.[0] as
      | { data?: { phone?: string | null } }
      | undefined;
    expect(userUpdateCall?.data?.phone).toBeNull();
  });

  it('lança NotFoundException quando usuário não existe', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('u1', 'pass')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança UnauthorizedException quando senha incorreta', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(user);
    mockCrypto.verifyPassword.mockResolvedValue(false);

    await expect(useCase.execute('u1', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lança UnauthorizedException quando hash/salt ausentes', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...user,
      hash: null,
      salt: null,
    });

    await expect(useCase.execute('u1', 'pass')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockCrypto.verifyPassword).not.toHaveBeenCalled();
  });
});
