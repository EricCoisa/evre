import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RegisterUseCase } from './register.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { EmailService } from '../../email/email.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';

const newUser = {
  id: 'u1',
  email: 'new@b.com',
  name: 'Test',
  role: 'USER',
  salt: 's',
  hash: 'h',
};
const txMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn().mockResolvedValue(newUser),
  },
  role: { findUnique: vi.fn().mockResolvedValue({ id: 'role-uuid' }) },
  roleRouteAccess: { findMany: vi.fn().mockResolvedValue([]) },
  userRouteAccess: { createMany: vi.fn() },
};
const mockPrisma = {
  $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) =>
    fn(txMock),
  ),
};
const mockCrypto = {
  generatePasswordHash: vi.fn().mockResolvedValue({ hash: 'h', salt: 's' }),
};
const mockLogging = { create: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };
const mockEmail = { send: vi.fn() };
const mockSysConfig = { findByLabelKey: vi.fn() };

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        RegisterUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: LoggingService, useValue: mockLogging },
        { provide: I18nService, useValue: mockI18n },
        { provide: EmailService, useValue: mockEmail },
        { provide: SystemConfigurationService, useValue: mockSysConfig },
      ],
    }).compile();
    useCase = mod.get(RegisterUseCase);
    vi.clearAllMocks();
    mockCrypto.generatePasswordHash.mockResolvedValue({ hash: 'h', salt: 's' });
    txMock.user.findUnique.mockResolvedValue(null);
    txMock.role.findUnique.mockResolvedValue({ id: 'role-uuid' });
    txMock.roleRouteAccess.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
    );
    txMock.user.create.mockResolvedValue(newUser);
    mockLogging.create.mockResolvedValue(undefined);
  });

  it('cria usuário e retorna sem hash/salt', async () => {
    txMock.user.findUnique.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'new@b.com',
      password: 'Pass1!',
      name: 'Test',
      role: 'USER',
    });

    expect(txMock.user.create).toHaveBeenCalled();
    expect(result).not.toHaveProperty('hash');
    expect(result).not.toHaveProperty('salt');
    expect(result.email).toBe('new@b.com');
  });

  it('lança ConflictException se email já existe', async () => {
    txMock.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      useCase.execute({
        email: 'new@b.com',
        password: 'Pass1!',
        role: 'USER' as const,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('persiste o aceite de termos recebido (signup e OAuth dependem disso)', async () => {
    txMock.user.findUnique.mockResolvedValue(null);
    const acceptedAt = new Date('2026-01-15T10:00:00Z');

    await useCase.execute({
      email: 'new@b.com',
      password: 'Pass1!',
      role: 'USER' as const,
      termsAcceptedAt: acceptedAt,
      termsVersion: '2.0',
    });

    expect(txMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          termsAcceptedAt: acceptedAt,
          termsVersion: '2.0',
        }),
      }),
    );
  });

  it('grava termos como null quando o chamador não envia (register de admin)', async () => {
    txMock.user.findUnique.mockResolvedValue(null);

    await useCase.execute({
      email: 'new@b.com',
      password: 'Pass1!',
      role: 'USER' as const,
    });

    expect(txMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          termsAcceptedAt: null,
          termsVersion: null,
        }),
      }),
    );
  });

  it('cria userRouteAccess para rotas da role quando existem', async () => {
    txMock.user.findUnique.mockResolvedValue(null);
    txMock.role.findUnique.mockResolvedValue({ id: 'role-uuid' });
    txMock.roleRouteAccess.findMany.mockResolvedValue([
      { routeId: 'r1' },
      { routeId: 'r2' },
    ]);

    await useCase.execute({
      email: 'new@b.com',
      password: 'Pass1!',
      role: 'USER' as const,
    });

    expect(txMock.userRouteAccess.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ routeId: 'r1' }),
        ]),
      }),
    );
  });
});
