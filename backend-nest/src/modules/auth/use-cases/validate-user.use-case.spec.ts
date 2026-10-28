import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ValidateUserUseCase } from './validate-user.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';

const mockPrisma = { user: { findFirst: vi.fn(), update: vi.fn() } };
const mockCrypto = { verifyPassword: vi.fn() };
const mockLogging = { create: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };

const activeUser = {
  id: 'u1',
  email: 'a@b.com',
  role: 'USER',
  hash: 'h',
  salt: 's',
  status: 'ACTIVE',
  loginAttempts: 0,
  lockUntil: null,
  deletedAt: null,
};

describe('ValidateUserUseCase', () => {
  let useCase: ValidateUserUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ValidateUserUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: LoggingService, useValue: mockLogging },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(ValidateUserUseCase);
    vi.clearAllMocks();
    mockLogging.create.mockResolvedValue(undefined);
    mockPrisma.user.update.mockResolvedValue({});
  });

  it('retorna UserPayload para usuário ativo com senha correta', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(activeUser);
    mockCrypto.verifyPassword.mockResolvedValue(true);

    const result = await useCase.execute('a@b.com', 'pass');

    expect(result).toMatchObject({
      id: 'u1',
      email: 'a@b.com',
      status: 'ACTIVE',
    });
  });

  it('retorna null quando usuário não existe', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockCrypto.verifyPassword.mockResolvedValue(false);

    const result = await useCase.execute('ghost@b.com', 'pass');
    expect(result).toBeNull();
  });

  it('retorna null quando senha inválida e incrementa loginAttempts', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      loginAttempts: 0,
    });
    mockCrypto.verifyPassword.mockResolvedValue(false);

    const result = await useCase.execute('a@b.com', 'wrong');

    expect(result).toBeNull();
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ loginAttempts: 1 }),
      }),
    );
  });

  it('bloqueia conta após 5 tentativas inválidas', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      loginAttempts: 4,
    });
    mockCrypto.verifyPassword.mockResolvedValue(false);

    await useCase.execute('a@b.com', 'wrong');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loginAttempts: 0,
          lockUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('lança ForbiddenException quando conta bloqueada recebe a senha correta', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    mockPrisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      lockUntil: futureDate,
    });
    mockCrypto.verifyPassword.mockResolvedValue(true);

    await expect(useCase.execute('a@b.com', 'pass')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('passa os minutos restantes como args ao traduzir account_locked', async () => {
    const futureDate = new Date(Date.now() + 10 * 60_000);
    mockPrisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      lockUntil: futureDate,
    });
    mockCrypto.verifyPassword.mockResolvedValue(true);

    await expect(useCase.execute('a@b.com', 'pass')).rejects.toThrow();

    expect(mockI18n.t).toHaveBeenCalledWith('auth.login.account_locked', {
      args: { minutes: 10 },
    });
  });

  it('senha errada em conta bloqueada retorna null genérico, não 403 — evita enumeração de conta', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    mockPrisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      lockUntil: futureDate,
    });
    mockCrypto.verifyPassword.mockResolvedValue(false);

    const result = await useCase.execute('a@b.com', 'wrong');

    expect(result).toBeNull();
  });

  it('retorna null para usuário INACTIVE', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      status: 'INACTIVE',
    });
    mockCrypto.verifyPassword.mockResolvedValue(true);

    const result = await useCase.execute('a@b.com', 'pass');
    expect(result).toBeNull();
  });

  it('lança ForbiddenException para usuário SUSPENDED', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      status: 'SUSPENDED',
    });
    mockCrypto.verifyPassword.mockResolvedValue(true);

    await expect(useCase.execute('a@b.com', 'pass')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('reseta loginAttempts após login bem-sucedido se havia tentativas anteriores', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      loginAttempts: 2,
    });
    mockCrypto.verifyPassword.mockResolvedValue(true);

    await useCase.execute('a@b.com', 'pass');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ loginAttempts: 0, lockUntil: null }),
      }),
    );
  });
});
