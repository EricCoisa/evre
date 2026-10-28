import { Test } from '@nestjs/testing';
import { LoginUseCase } from './login.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { hashSource } from 'src/common/utils/request-source.util';

const mockPrisma = {
  user: { findUnique: vi.fn() },
  refreshToken: { create: vi.fn() },
};
// O use-case lê o `exp` do token que acabou de assinar para derivar o `expiresAt` da
// linha em refresh_tokens, então o mock precisa devolver algo com forma de JWT.
const TOKEN_EXP = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
const fakeJwt = (exp: number) =>
  `h.${Buffer.from(JSON.stringify({ sub: 'u1', exp })).toString('base64url')}.s`;
const SIGNED = fakeJwt(TOKEN_EXP);

const mockJwt = { signAsync: vi.fn().mockResolvedValue(SIGNED) };
const mockConfig = { get: vi.fn().mockReturnValue('secret') };
const mockLogging = { create: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };

const USER = { id: 'u1', email: 'a@b.com', role: 'USER' as const };
const SOURCE = { ip: '203.0.113.5', userAgent: 'vitest-agent' };

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: LoggingService, useValue: mockLogging },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(LoginUseCase);
    vi.clearAllMocks();
    mockJwt.signAsync.mockResolvedValue(SIGNED);
    mockLogging.create.mockResolvedValue(undefined);
    mockPrisma.refreshToken.create.mockResolvedValue({});
  });

  it('emite accessToken e refreshToken com roleId e roleName do DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'USER',
      roleId: 'role-uuid',
      roleRecord: { name: 'USER' },
    });

    const result = await useCase.execute(USER, SOURCE);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
      }),
    );
    expect(mockJwt.signAsync).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      accessToken: SIGNED,
      refreshToken: SIGNED,
    });
  });

  it('usa role enum como roleName quando roleRecord é null (fallback)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'USER',
      roleId: null,
      roleRecord: null,
    });

    const result = await useCase.execute(USER, SOURCE);

    expect(result.accessToken).toBe(SIGNED);
    const payloadCall = mockJwt.signAsync.mock.calls[0][0];
    expect(payloadCall.roleName).toBe('USER');
  });

  it('cria refreshToken no DB após login', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'USER',
      roleId: null,
      roleRecord: null,
    });

    await useCase.execute(USER, SOURCE);

    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          sourceIpHash: hashSource(SOURCE.ip),
          sourceUaHash: hashSource(SOURCE.userAgent),
        }),
      }),
    );
  });

  it('grava expiresAt igual ao exp do refresh token, não uma constante fixa', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'USER',
      roleId: null,
      roleRecord: null,
    });
    const exp = Math.floor(Date.now() / 1000) + 300;
    mockJwt.signAsync.mockResolvedValue(fakeJwt(exp));

    await useCase.execute(USER, SOURCE);

    const { expiresAt } = mockPrisma.refreshToken.create.mock.calls[0][0].data;
    expect(expiresAt.getTime()).toBe(exp * 1000);
  });

  it('respeita JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN do ConfigService', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'USER',
      roleId: null,
      roleRecord: null,
    });
    mockConfig.get.mockImplementation((key: string) =>
      key === 'JWT_EXPIRES_IN'
        ? '45s'
        : key === 'JWT_REFRESH_EXPIRES_IN'
          ? '5m'
          : 'secret',
    );

    await useCase.execute(USER, SOURCE);

    expect(mockJwt.signAsync.mock.calls[0][1].expiresIn).toBe('45s');
    expect(mockJwt.signAsync.mock.calls[1][1].expiresIn).toBe('5m');
    mockConfig.get.mockReturnValue('secret');
  });
});
