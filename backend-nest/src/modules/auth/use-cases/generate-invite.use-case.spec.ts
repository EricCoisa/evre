import { Test } from '@nestjs/testing';
import { GenerateInviteUseCase } from './generate-invite.use-case';
import {
  ServiceUnavailableException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/email.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { ShortUrlService } from '../../short-url/short-url.service';
import { createHash } from 'node:crypto';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const mockTx = {
  $queryRaw: vi.fn(),
  invite: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: { findUnique: vi.fn(), update: vi.fn() },
};

const mockPrisma = {
  role: { findUnique: vi.fn() },
  invite: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn((callback: (tx: typeof mockTx) => unknown) =>
    callback(mockTx),
  ),
};
const mockJwt = {
  signAsync: vi.fn().mockResolvedValue('tok'),
  verifyAsync: vi.fn(),
};
const mockConfig = { get: vi.fn().mockReturnValue('secret') };
const mockEmail = {
  checkHealth: vi.fn(),
  sendNow: vi.fn(),
  renderTemplate: vi.fn().mockResolvedValue('<html>invite</html>'),
};
const mockLogging = { create: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };
const mockSysConfig = { findByLabelKey: vi.fn() };
const mockShortUrl = {
  shorten: vi.fn().mockResolvedValue({
    id: 'short-1',
    code: 'abc12345',
    shortUrl: 'http://localhost:3000/s/abc12345',
    targetUrl: 'http://localhost:3000/signup?inviteToken=tok',
    purpose: 'INVITE',
    clicksCount: 0,
    maxClicks: null,
    expiresAt: new Date(),
    createdAt: new Date(),
  }),
  deactivate: vi.fn().mockResolvedValue(undefined),
};
const DTO = { email: 'a@b.com', roleId: 'role-1', createdById: 'user-1' };
const ROLE = { id: 'role-1', name: 'USER' };

async function buildUseCase() {
  const mod = await Test.createTestingModule({
    providers: [
      GenerateInviteUseCase,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: JwtService, useValue: mockJwt },
      { provide: ConfigService, useValue: mockConfig },
      { provide: EmailService, useValue: mockEmail },
      { provide: LoggingService, useValue: mockLogging },
      { provide: I18nService, useValue: mockI18n },
      { provide: SystemConfigurationService, useValue: mockSysConfig },
      { provide: ShortUrlService, useValue: mockShortUrl },
    ],
  }).compile();
  return mod.get(GenerateInviteUseCase);
}

describe('GenerateInviteUseCase', () => {
  let useCase: GenerateInviteUseCase;

  beforeEach(async () => {
    useCase = await buildUseCase();
    vi.clearAllMocks();
    mockEmail.checkHealth.mockResolvedValue({ operational: true });
    mockEmail.sendNow.mockResolvedValue({ status: true, data: 'sent' });
    mockPrisma.role.findUnique.mockResolvedValue(ROLE);
    mockPrisma.invite.upsert.mockResolvedValue({});
    mockPrisma.invite.findUnique.mockResolvedValue(null);
    mockTx.invite.findUnique.mockResolvedValue(null);
    mockTx.invite.upsert.mockResolvedValue({});
    mockLogging.create.mockResolvedValue(undefined);
    mockSysConfig.findByLabelKey.mockResolvedValue({ value: 'MyApp' });
    mockShortUrl.shorten.mockResolvedValue({
      id: 'short-1',
      code: 'abc12345',
      shortUrl: 'http://localhost:3000/s/abc12345',
      targetUrl: 'http://localhost:3000/signup?inviteToken=tok',
      purpose: 'INVITE',
      clicksCount: 0,
      maxClicks: null,
      expiresAt: new Date(),
      createdAt: new Date(),
    });
    mockShortUrl.deactivate.mockResolvedValue(undefined);
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  it('gate: bloqueia com 503 quando email está inoperante', async () => {
    mockEmail.checkHealth.mockResolvedValue({
      operational: false,
      reason: 'invalid key',
    });

    await expect(useCase.execute(DTO)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockPrisma.role.findUnique).not.toHaveBeenCalled();
    expect(mockTx.invite.upsert).not.toHaveBeenCalled();
    expect(mockEmail.sendNow).not.toHaveBeenCalled();
  });

  it('retorna 404 quando a role do convite não existe', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(DTO)).rejects.toThrow(NotFoundException);
    expect(mockTx.invite.upsert).not.toHaveBeenCalled();
    expect(mockEmail.sendNow).not.toHaveBeenCalled();
  });

  it('remove o convite criado e desativa o link curto quando o envio do email falha', async () => {
    mockEmail.sendNow.mockResolvedValue({
      status: false,
      data: 'delivery failed',
    });

    await expect(useCase.execute(DTO)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mockShortUrl.deactivate).toHaveBeenCalledWith('abc12345');
    expect(mockTx.invite.deleteMany).toHaveBeenCalledWith({
      where: { email: 'a@b.com', tokenHash: hashToken('tok') },
    });
  });

  it('restaura convite anterior se a nova emissão falhar ao enviar', async () => {
    const previousInvite = {
      roleId: 'old-role',
      createdById: 'old-admin',
      expiresAt: new Date('2026-10-01T00:00:00.000Z'),
      actionUrl: null,
      tokenHash: 'old-hash',
      usedAt: null,
    };
    mockTx.invite.findUnique.mockResolvedValue(previousInvite);
    mockEmail.sendNow.mockRejectedValue(new Error('mail transport failed'));

    await expect(useCase.execute(DTO)).rejects.toThrow('mail transport failed');

    expect(mockShortUrl.deactivate).toHaveBeenCalledWith('abc12345');
    expect(mockTx.invite.updateMany).toHaveBeenCalledWith({
      where: { email: 'a@b.com', tokenHash: hashToken('tok') },
      data: previousInvite,
    });
  });

  it('stores only a hash of the invite token and never persists the bearer URL', async () => {
    await useCase.execute(DTO);
    expect(mockTx.invite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          actionUrl: null,
          tokenHash: hashToken('tok'),
        }),
      }),
    );
  });

  it('createdById de admin usa o template de convite com link curto', async () => {
    await useCase.execute(DTO);

    expect(mockShortUrl.shorten).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: 'http://localhost:3000/signup?inviteToken=tok',
        purpose: 'INVITE',
        createdById: 'user-1',
      }),
    );
    expect(mockEmail.renderTemplate).toHaveBeenCalledWith(
      'INVITATION',
      expect.objectContaining({
        action_url: 'http://localhost:3000/s/abc12345',
      }),
    );
    expect(mockEmail.sendNow).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Você foi convidado para se juntar ao sistema',
      }),
    );
  });

  it('happy path: retorna actionUrl encurtada quando email é enviado com sucesso', async () => {
    const result = await useCase.execute(DTO);

    expect(result).toEqual({ actionUrl: 'http://localhost:3000/s/abc12345' });
    expect(mockEmail.checkHealth).toHaveBeenCalledTimes(1);
    expect(mockEmail.sendNow).toHaveBeenCalledTimes(1);
    expect(mockTx.invite.upsert).toHaveBeenCalledTimes(1);
    expect(mockTx.$queryRaw).toHaveBeenCalled();
  });

  it('SYSTEM_APP_NAME ausente não quebra o fluxo (fallback null)', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    mockSysConfig.findByLabelKey.mockRejectedValue(
      new NotFoundException('not found'),
    );

    const result = await useCase.execute(DTO);

    expect(result).toHaveProperty('actionUrl');
    expect(mockEmail.sendNow).toHaveBeenCalledTimes(1);
  });
});

describe('GenerateInviteUseCase::validateInviteToken', () => {
  let useCase: GenerateInviteUseCase;
  const VALID_PAYLOAD = {
    email: 'test@example.com',
    role: 'USER',
    roleId: 'role-1',
    createdById: 'user-1',
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    useCase = await buildUseCase();
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
  });

  it('aceita token válido com invite não usado no banco', async () => {
    mockJwt.verifyAsync = vi.fn().mockResolvedValue(VALID_PAYLOAD);
    mockPrisma.invite.findFirst.mockResolvedValue({
      id: 'invite-1',
      email: 'test@example.com',
      roleId: 'role-1',
      createdById: 'user-1',
      tokenHash: hashToken('valid-token'),
      usedAt: null,
      role: { id: 'role-1', name: 'USER' },
    });

    const result = await useCase.validateInviteToken('valid-token');

    expect(result).toEqual({
      ...VALID_PAYLOAD,
      inviteId: 'invite-1',
      tokenHash: hashToken('valid-token'),
      name: null,
      userExists: false,
    });
    expect(mockPrisma.invite.findFirst).toHaveBeenCalledWith({
      where: {
        email: 'test@example.com',
        tokenHash: hashToken('valid-token'),
        usedAt: null,
        expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      },
      include: { role: { select: { id: true, name: true } } },
    });
  });

  // `userExists` decide a tela do convite: cadastrar (não tem conta) ou aceitar (tem).
  it('sinaliza userExists quando o convidado já tem conta com outra role', async () => {
    mockJwt.verifyAsync = vi.fn().mockResolvedValue(VALID_PAYLOAD);
    mockPrisma.invite.findFirst.mockResolvedValue({
      id: 'invite-1',
      email: 'test@example.com',
      roleId: 'role-1',
      createdById: 'user-1',
      tokenHash: hashToken('valid-token'),
      usedAt: null,
      role: { id: 'role-1', name: 'USER' },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
      roleId: 'outra-role',
    });

    const result = await useCase.validateInviteToken('valid-token');

    expect(result.userExists).toBe(true);
  });

  it('rejeita token quando invite já foi usado (usedAt IS NOT NULL)', async () => {
    const { UnauthorizedException } = await import('@nestjs/common');
    mockJwt.verifyAsync = vi.fn().mockResolvedValue(VALID_PAYLOAD);
    mockPrisma.invite.findFirst.mockResolvedValue(null); // findFirst retorna null pq usedAt !== null

    await expect(useCase.validateInviteToken('used-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockI18n.t).toHaveBeenCalledWith('auth.invite.already_used');
  });

  it('rejeita token inválido ou expirado', async () => {
    const { UnauthorizedException } = await import('@nestjs/common');
    mockJwt.verifyAsync = vi.fn().mockRejectedValue(new Error('jwt expired'));

    await expect(useCase.validateInviteToken('expired-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockI18n.t).toHaveBeenCalledWith('auth.invite.invalid_token');
  });

  it('rejeita quando usuário já é membro com mesma role', async () => {
    const { ConflictException } = await import('@nestjs/common');
    mockJwt.verifyAsync = vi.fn().mockResolvedValue(VALID_PAYLOAD);
    mockPrisma.invite.findFirst.mockResolvedValue({
      id: 'invite-1',
      email: 'test@example.com',
      roleId: 'role-1',
      createdById: 'user-1',
      tokenHash: hashToken('token'),
      usedAt: null,
      role: { id: 'role-1', name: 'USER' },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      roleId: 'role-1',
    });

    await expect(useCase.validateInviteToken('token')).rejects.toThrow(
      ConflictException,
    );
    expect(mockI18n.t).toHaveBeenCalledWith('auth.invite.already_member');
  });
});

describe('GenerateInviteUseCase::acceptInvite', () => {
  let useCase: GenerateInviteUseCase;
  const VALID_PAYLOAD = {
    email: 'invited@example.com',
    role: 'USER',
    roleId: 'role-1',
    createdById: 'user-1',
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    useCase = await buildUseCase();
    vi.clearAllMocks();
    mockJwt.verifyAsync = vi.fn().mockResolvedValue(VALID_PAYLOAD);
    mockPrisma.invite.findFirst.mockResolvedValue({
      id: 'invite-1',
      email: 'invited@example.com',
      roleId: 'role-1',
      createdById: 'user-1',
      tokenHash: hashToken('tok'),
      role: { id: 'role-1', name: 'USER' },
      usedAt: null,
    });
    mockTx.invite.findFirst.mockResolvedValue({
      id: 'invite-1',
      email: 'invited@example.com',
      tokenHash: hashToken('tok'),
      roleId: 'role-1',
    });
    mockTx.invite.updateMany.mockResolvedValue({ count: 1 });
    mockTx.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'invited@example.com',
    });
  });

  it('promotes only the authenticated invited account and consumes the invite atomically', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'invited@example.com',
      roleId: 'outra-role',
    });

    const result = await useCase.acceptInvite(
      { token: 'tok' },
      { id: 'u1', email: 'invited@example.com' },
    );

    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { roleId: 'role-1' },
    });
    expect(mockTx.invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'invite-1' }),
      }),
    );
    expect(result).toEqual({ created: 'user_updated' });
  });

  it('does not allow the authenticated account to accept another email address invite', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      useCase.acceptInvite(
        { token: 'tok' },
        { id: 'u-other', email: 'other@example.com' },
      ),
    ).rejects.toThrow('auth.invite.email_mismatch');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
