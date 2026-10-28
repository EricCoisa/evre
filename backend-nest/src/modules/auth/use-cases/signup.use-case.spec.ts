import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignupUseCase } from './signup.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { GenerateInviteUseCase } from './generate-invite.use-case';
import { RegisterUseCase } from './register.use-case';
import { EmailService } from '../../email/email.service';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../../logging/logging.service';
import { ShortUrlService } from '../../short-url/short-url.service';

const mockTransaction = {
  $queryRaw: vi.fn(),
  user: { findUnique: vi.fn() },
  signupIntent: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  invite: { findFirst: vi.fn(), updateMany: vi.fn() },
};
const mockPrisma = {
  user: { findUnique: vi.fn() },
  signupIntent: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(
    (operation: (tx: typeof mockTransaction) => Promise<unknown>) =>
      operation(mockTransaction),
  ),
};
const mockI18n = { t: vi.fn((key: string) => key) };
const mockSysConfig = { getValueOrNull: vi.fn() };
const mockGenerateInvite = { validateInviteToken: vi.fn() };
const mockRegister = {
  createInTransaction: vi.fn(),
  logRegistration: vi.fn(),
};
const mockEmail = {
  checkHealth: vi.fn(),
  renderTemplate: vi.fn(),
  send: vi.fn(),
};
const mockConfig = { get: vi.fn(() => 'https://app.example.com') };
const mockLogging = { create: vi.fn() };
const mockShortUrl = {
  shorten: vi.fn().mockImplementation(({ targetUrl }) =>
    Promise.resolve({
      id: 'short-signup-1',
      code: 'sgn12345',
      shortUrl: 'https://app.example.com/s/sgn12345',
      targetUrl,
      purpose: 'SIGNUP',
      clicksCount: 0,
      maxClicks: null,
      expiresAt: new Date(),
      createdAt: new Date(),
    }),
  ),
  deactivate: vi.fn().mockResolvedValue(undefined),
};

describe('SignupUseCase', () => {
  let useCase: SignupUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SignupUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: SystemConfigurationService, useValue: mockSysConfig },
        { provide: GenerateInviteUseCase, useValue: mockGenerateInvite },
        { provide: RegisterUseCase, useValue: mockRegister },
        { provide: EmailService, useValue: mockEmail },
        { provide: ConfigService, useValue: mockConfig },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ShortUrlService, useValue: mockShortUrl },
      ],
    }).compile();
    useCase = mod.get(SignupUseCase);
    vi.clearAllMocks();
    mockSysConfig.getValueOrNull.mockImplementation((key: string) => {
      if (key === 'SYSTEM_USER_CREATE') return Promise.resolve(true);
      if (key === 'SYSTEM_TERMS_VERSION') return Promise.resolve('1.0');
      if (key === 'SYSTEM_APP_NAME') return Promise.resolve('App');
      return Promise.resolve(null);
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.signupIntent.findFirst.mockResolvedValue(null);
    mockPrisma.signupIntent.create.mockResolvedValue({ id: 'intent-1' });
    mockPrisma.signupIntent.updateMany.mockResolvedValue({ count: 1 });
    mockTransaction.signupIntent.updateMany.mockResolvedValue({ count: 1 });
    mockTransaction.user.findUnique.mockResolvedValue(null);
    mockTransaction.signupIntent.findFirst.mockResolvedValue(null);
    mockTransaction.signupIntent.create.mockResolvedValue({ id: 'intent-1' });
    mockTransaction.invite.findFirst.mockResolvedValue({
      id: 'invite-1',
      email: 'invited@example.com',
      roleId: 'role-admin',
      tokenHash: 'invite-hash',
      expiresAt: new Date(Date.now() + 60_000),
      role: { name: 'ADMIN' },
    });
    mockTransaction.invite.updateMany.mockResolvedValue({ count: 1 });
    mockRegister.createInTransaction.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
    });
    mockRegister.logRegistration.mockResolvedValue(undefined);
    mockLogging.create.mockResolvedValue(undefined);
    mockEmail.checkHealth.mockResolvedValue({ operational: true });
    mockEmail.renderTemplate.mockResolvedValue('<html/>');
    mockEmail.send.mockResolvedValue({ status: true });
    mockShortUrl.shorten.mockImplementation(({ targetUrl }) =>
      Promise.resolve({
        id: 'short-signup-1',
        code: 'sgn12345',
        shortUrl: 'https://app.example.com/s/sgn12345',
        targetUrl,
        purpose: 'SIGNUP',
        clicksCount: 0,
        maxClicks: null,
        expiresAt: new Date(),
        createdAt: new Date(),
      }),
    );
    mockShortUrl.deactivate.mockResolvedValue(undefined);
    mockGenerateInvite.validateInviteToken.mockResolvedValue({
      email: 'invited@example.com',
      role: 'ADMIN',
      inviteId: 'invite-1',
      tokenHash: 'invite-hash',
    });
  });

  it('sends a one-time email confirmation with shortened link without creating an invite or user', async () => {
    const result = await useCase.execute({
      email: ' Alice@Example.com ',
      name: 'Alice',
    });

    expect(result).toEqual({
      accountCreated: false,
      email: 'alice@example.com',
    });
    expect(mockTransaction.signupIntent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'alice@example.com',
          purpose: 'PASSWORD',
          tokenHash: expect.any(String),
        }),
      }),
    );
    expect(mockShortUrl.shorten).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'SIGNUP',
      }),
    );
    expect(mockEmail.renderTemplate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action_url: 'https://app.example.com/s/sgn12345',
      }),
    );
    expect(mockEmail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alice@example.com' }),
    );
    expect(mockTransaction.$queryRaw).toHaveBeenCalled();
    expect(mockGenerateInvite.validateInviteToken).not.toHaveBeenCalled();
    expect(mockRegister.createInTransaction).not.toHaveBeenCalled();
  });

  it('returns the same response for an email that already has an account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      useCase.execute({ email: 'existing@example.com' }),
    ).resolves.toEqual({
      accountCreated: false,
      email: 'existing@example.com',
    });
    expect(mockEmail.send).not.toHaveBeenCalled();
    expect(mockTransaction.signupIntent.create).not.toHaveBeenCalled();
  });

  it('does not allow self-signup when SYSTEM_USER_CREATE is disabled', async () => {
    mockSysConfig.getValueOrNull.mockImplementation((key: string) =>
      Promise.resolve(key === 'SYSTEM_USER_CREATE' ? 'false' : null),
    );

    await expect(useCase.execute({ email: 'a@b.com' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockEmail.send).not.toHaveBeenCalled();
  });

  it('does not create self-signup intent when email is not operational', async () => {
    mockEmail.checkHealth.mockResolvedValue({ operational: false });

    await expect(useCase.execute({ email: 'a@b.com' })).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockTransaction.signupIntent.create).not.toHaveBeenCalled();
  });

  it('enforces a resend cooldown for pending email confirmations', async () => {
    mockTransaction.signupIntent.findFirst.mockResolvedValue({ id: 'recent' });

    await expect(useCase.execute({ email: 'a@b.com' })).resolves.toMatchObject({
      accountCreated: false,
    });
    expect(mockEmail.send).not.toHaveBeenCalled();
    expect(mockShortUrl.shorten).not.toHaveBeenCalled();
  });

  it('creates a USER only after a valid one-time token and explicit terms acceptance', async () => {
    await useCase.execute({ email: 'a@b.com', name: 'Alice' });
    const shortenArg = mockShortUrl.shorten.mock.calls[0][0] as {
      targetUrl: string;
    };
    const token = new URL(shortenArg.targetUrl).searchParams.get(
      'signupToken',
    )!;
    const [id, secret] = token.split('.');
    mockPrisma.signupIntent.findUnique.mockResolvedValue({
      id,
      email: 'alice@example.com',
      name: 'Alice',
      purpose: 'PASSWORD',
      tokenHash: createHash('sha256').update(secret).digest('hex'),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    await expect(
      useCase.completeEmailSignup({
        token,
        password: 'Pass123!',
        acceptTerms: true,
      }),
    ).resolves.toEqual({
      accountCreated: true,
      user: { id: 'u1', email: 'a@b.com' },
    });
    expect(mockRegister.createInTransaction).toHaveBeenCalledWith(
      mockTransaction,
      expect.objectContaining({
        email: 'alice@example.com',
        name: 'Alice',
        password: 'Pass123!',
        role: 'USER',
        termsAcceptedAt: expect.any(Date),
      }),
    );
    expect(mockTransaction.signupIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id,
          usedAt: null,
          expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
        }),
      }),
    );
  });

  it('rejects signup completion without explicit acceptance of terms', async () => {
    await expect(
      useCase.completeEmailSignup({
        token: 'id.secret',
        password: 'Pass123!',
        acceptTerms: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.signupIntent.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an invite signup without a password as an invalid payload', async () => {
    await expect(
      useCase.execute({
        email: 'invited@example.com',
        inviteToken: 'valid-token',
        acceptTerms: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid confirmation tokens and records a failed attempt', async () => {
    mockPrisma.signupIntent.findUnique.mockResolvedValue({
      id: 'intent-1',
      purpose: 'PASSWORD',
      tokenHash: createHash('sha256').update('right-secret').digest('hex'),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    await expect(
      useCase.completeEmailSignup({
        token: 'intent-1.wrong-secret',
        password: 'Pass123!',
        acceptTerms: true,
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.signupIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'intent-1', attempts: { lt: 5 } }),
        data: { attempts: { increment: 1 } },
      }),
    );
    expect(mockRegister.createInTransaction).not.toHaveBeenCalled();
  });

  it('creates invited accounts even when autonomous signup is disabled', async () => {
    mockSysConfig.getValueOrNull.mockImplementation((key: string) =>
      Promise.resolve(key === 'SYSTEM_USER_CREATE' ? false : '1.0'),
    );

    await expect(
      useCase.execute({
        email: 'ignored@example.com',
        password: 'Pass123!',
        acceptTerms: true,
        inviteToken: 'invite-token',
      }),
    ).resolves.toMatchObject({ accountCreated: true });
    expect(mockRegister.createInTransaction).toHaveBeenCalledWith(
      mockTransaction,
      expect.objectContaining({
        email: 'invited@example.com',
        role: 'ADMIN',
      }),
    );
  });
});
