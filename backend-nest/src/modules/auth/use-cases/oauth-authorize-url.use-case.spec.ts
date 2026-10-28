import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OauthAuthorizeUrlUseCase } from './oauth-authorize-url.use-case';
import { OauthProvidersUseCase } from './oauth-providers.use-case';
import { GenerateInviteUseCase } from './generate-invite.use-case';
import { OidcDiscoveryService } from '../oidc-discovery.service';
import { SignupUseCase } from './signup.use-case';
import { I18nService } from 'nestjs-i18n';

const mockProviders = { getConfiguredOrThrow: vi.fn() };
const mockGenerateInvite = { validateInviteToken: vi.fn() };
const mockDiscovery = { discover: vi.fn() };
const mockSignup = { isAutonomousSignupAvailable: vi.fn() };
const mockJwt = { signAsync: vi.fn() };
const mockI18n = { t: vi.fn((key: string) => key) };
const mockConfig = {
  get: vi.fn((key: string) =>
    key === 'NEXTAUTH_URL' ? 'https://app.example.com/' : 'jwt-secret',
  ),
};

describe('OauthAuthorizeUrlUseCase', () => {
  let useCase: OauthAuthorizeUrlUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        OauthAuthorizeUrlUseCase,
        { provide: OauthProvidersUseCase, useValue: mockProviders },
        { provide: GenerateInviteUseCase, useValue: mockGenerateInvite },
        { provide: OidcDiscoveryService, useValue: mockDiscovery },
        { provide: SignupUseCase, useValue: mockSignup },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(OauthAuthorizeUrlUseCase);
    vi.clearAllMocks();

    mockProviders.getConfiguredOrThrow.mockResolvedValue({
      id: 'GOOGLE',
      label: 'Google',
      issuer: 'https://accounts.google.com',
      clientId: 'client-123',
      clientSecret: 'secret-456',
    });
    mockDiscovery.discover.mockResolvedValue({
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    });
    mockJwt.signAsync.mockResolvedValue('signed-state');
    mockSignup.isAutonomousSignupAvailable.mockResolvedValue(true);
  });

  it('monta a URL com redirect_uri apontando para o frontend', async () => {
    const { url } = await useCase.execute('GOOGLE', '/dashboard');
    const params = new URL(url).searchParams;

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('client_id')).toBe('client-123');
    expect(params.get('redirect_uri')).toBe(
      'https://app.example.com/api/auth/oauth/callback',
    );
    expect(params.get('scope')).toBe('openid email profile');
    expect(params.get('state')).toBe('signed-state');
    expect(params.get('nonce')).toBeTruthy();
  });

  it('assina o state com o nonce que vai na URL', async () => {
    const { url } = await useCase.execute('GOOGLE');
    const nonce = new URL(url).searchParams.get('nonce');

    const payload = mockJwt.signAsync.mock.calls[0][0] as { nonce: string };
    expect(payload.nonce).toBe(nonce);
  });

  it('assina a finalidade de login no state e não cria conta', async () => {
    await useCase.execute('GOOGLE');

    const payload = mockJwt.signAsync.mock.calls[0][0] as {
      intent: string;
    };
    expect(payload.intent).toBe('LOGIN');
  });

  it('permite iniciar signup OAuth apenas com cadastro autônomo operacional', async () => {
    mockSignup.isAutonomousSignupAvailable.mockResolvedValue(false);

    await expect(
      useCase.execute('GOOGLE', undefined, undefined, 'SIGNUP'),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockJwt.signAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['https://evil.com/phish', 'absoluto'],
    ['//evil.com', 'protocol-relative'],
    ['dashboard', 'sem barra inicial'],
  ])('descarta callbackUrl %s (%s)', async (callbackUrl) => {
    await useCase.execute('GOOGLE', callbackUrl);

    const payload = mockJwt.signAsync.mock.calls[0][0] as {
      callbackUrl?: string;
    };
    expect(payload.callbackUrl).toBeUndefined();
  });

  it('preserva callbackUrl relativo', async () => {
    await useCase.execute('GOOGLE', '/settings?tab=emailConfig');

    const payload = mockJwt.signAsync.mock.calls[0][0] as {
      callbackUrl?: string;
    };
    expect(payload.callbackUrl).toBe('/settings?tab=emailConfig');
  });

  // ── convites ──────────────────────────────────────────────────

  it('sem convite, o state não carrega inviteEmail', async () => {
    await useCase.execute('GOOGLE');

    const payload = mockJwt.signAsync.mock.calls[0][0] as {
      inviteEmail?: string;
    };
    expect(payload.inviteEmail).toBeUndefined();
    expect(mockGenerateInvite.validateInviteToken).not.toHaveBeenCalled();
  });

  it('assina apenas o email do convite, nunca o token', async () => {
    mockGenerateInvite.validateInviteToken.mockResolvedValue({
      email: 'convidado@example.com',
      role: 'ADMIN',
      roleId: 'role-admin',
      inviteId: 'invite-1',
      tokenHash: 'invite-hash',
    });

    const { url } = await useCase.execute('GOOGLE', undefined, 'invite-jwt');

    expect(mockGenerateInvite.validateInviteToken).toHaveBeenCalledWith(
      'invite-jwt',
    );
    const payload = mockJwt.signAsync.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload.inviteEmail).toBe('convidado@example.com');
    expect(payload.inviteId).toBe('invite-1');
    expect(payload.inviteTokenHash).toBe('invite-hash');
    expect(payload.intent).toBe('INVITE');
    expect(JSON.stringify(payload)).not.toContain('invite-jwt');
    expect(url).not.toContain('invite-jwt');
  });

  it('convite inválido não manda o usuário para o provider', async () => {
    mockGenerateInvite.validateInviteToken.mockRejectedValue(
      new UnauthorizedException(),
    );

    await expect(
      useCase.execute('GOOGLE', undefined, 'token-ruim'),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockJwt.signAsync).not.toHaveBeenCalled();
  });
});
