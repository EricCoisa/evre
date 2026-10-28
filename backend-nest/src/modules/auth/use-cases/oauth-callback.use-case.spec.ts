import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { OauthCallbackUseCase } from './oauth-callback.use-case';
import { OauthProvidersUseCase } from './oauth-providers.use-case';
import { OidcDiscoveryService } from '../oidc-discovery.service';
import { LoginUseCase } from './login.use-case';
import { SignupUseCase } from './signup.use-case';

const axiosPostFn = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: axiosPostFn } }));

const mockPrisma = {
  user: { findUnique: vi.fn() },
  invite: { findFirst: vi.fn() },
};
const mockProviders = { getConfiguredOrThrow: vi.fn() };
const mockDiscovery = { discover: vi.fn(), verifyIdToken: vi.fn() };
const mockLogin = { execute: vi.fn() };
const mockSignup = {
  isAutonomousSignupAvailable: vi.fn(),
  createProviderConsentIntent: vi.fn(),
  completeProviderConsent: vi.fn(),
};
const mockJwt = { verifyAsync: vi.fn() };
const mockConfig = { get: vi.fn().mockReturnValue('https://app.example.com') };
const mockI18n = { t: vi.fn((key: string) => key) };

const SOURCE = { ip: '203.0.113.5', userAgent: 'vitest-agent' };

const STATE = {
  sub: 'oauth-state',
  purpose: 'oauth_state',
  intent: 'LOGIN' as const,
  provider: 'GOOGLE',
  callbackUrl: '/dashboard',
  nonce: 'nonce-1',
};

describe('OauthCallbackUseCase', () => {
  let useCase: OauthCallbackUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        OauthCallbackUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OauthProvidersUseCase, useValue: mockProviders },
        { provide: OidcDiscoveryService, useValue: mockDiscovery },
        { provide: LoginUseCase, useValue: mockLogin },
        { provide: SignupUseCase, useValue: mockSignup },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = mod.get(OauthCallbackUseCase);
    vi.clearAllMocks();

    mockJwt.verifyAsync.mockResolvedValue({ ...STATE });
    mockProviders.getConfiguredOrThrow.mockResolvedValue({
      id: 'GOOGLE',
      label: 'Google',
      issuer: 'https://accounts.google.com',
      clientId: 'client-123',
      clientSecret: 'secret-456',
    });
    mockDiscovery.discover.mockResolvedValue({
      authorizationEndpoint: 'https://accounts.google.com/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      issuer: 'https://accounts.google.com',
      jwksUri: 'https://accounts.google.com/jwks',
    });
    axiosPostFn.mockResolvedValue({ data: { id_token: 'signed-id-token' } });
    mockDiscovery.verifyIdToken.mockResolvedValue({
      sub: 'provider-subject',
      email: 'Alice@Example.com ',
      email_verified: true,
      name: 'Alice',
      nonce: 'nonce-1',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'alice@example.com',
      roleId: 'role-1',
      status: 'ACTIVE',
      deletedAt: null,
    });
    mockPrisma.invite.findFirst.mockResolvedValue({
      id: 'invite-1',
      email: 'alice@example.com',
      roleId: 'role-admin',
      tokenHash: 'invite-hash',
    });
    mockLogin.execute.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
    });
    mockSignup.isAutonomousSignupAvailable.mockResolvedValue(true);
    mockSignup.createProviderConsentIntent.mockResolvedValue('intent.secret');
  });

  it('authenticates an existing active account without changing its role', async () => {
    const result = await useCase.execute('code-1', 'state-1', SOURCE);

    expect(mockDiscovery.verifyIdToken).toHaveBeenCalledWith(
      'https://accounts.google.com',
      'signed-id-token',
      'client-123',
    );
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'alice@example.com' },
    });
    expect(mockLogin.execute).toHaveBeenCalledWith(
      { id: 'u1', email: 'alice@example.com' },
      SOURCE,
    );
    expect(mockSignup.createProviderConsentIntent).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      tokens: { accessToken: 'at', refreshToken: 'rt' },
      callbackUrl: '/dashboard',
    });
  });

  it('requires explicit consent before creating an unknown provider account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await useCase.execute('code-1', 'state-1', SOURCE);

    expect(mockSignup.createProviderConsentIntent).toHaveBeenCalledWith({
      email: 'alice@example.com',
      name: 'Alice',
      providerId: 'GOOGLE',
      callbackUrl: '/dashboard',
    });
    expect(mockLogin.execute).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      consentRequired: true,
      signupToken: 'intent.secret',
      providerId: 'GOOGLE',
    });
  });

  it('returns a generic authentication error when autonomous signup is unavailable', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockSignup.isAutonomousSignupAvailable.mockResolvedValue(false);

    await expect(useCase.execute('code-1', 'state-1', SOURCE)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockSignup.createProviderConsentIntent).not.toHaveBeenCalled();
    expect(mockLogin.execute).not.toHaveBeenCalled();
  });

  it('does not issue a signup consent when the ID token fails cryptographic validation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockDiscovery.verifyIdToken.mockRejectedValue(new Error('bad signature'));

    await expect(useCase.execute('code-1', 'state-1', SOURCE)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockSignup.createProviderConsentIntent).not.toHaveBeenCalled();
  });

  it.each([false, 'false', undefined])(
    'rejects an email claim not strictly verified (%s)',
    async (verified) => {
      mockDiscovery.verifyIdToken.mockResolvedValue({
        sub: 'provider-subject',
        email: 'alice@example.com',
        email_verified: verified,
        nonce: 'nonce-1',
      });

      await expect(
        useCase.execute('code-1', 'state-1', SOURCE),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing subject or a nonce that does not match the signed state', async () => {
    mockDiscovery.verifyIdToken.mockResolvedValue({
      email: 'alice@example.com',
      email_verified: true,
      nonce: 'other-nonce',
    });

    await expect(useCase.execute('code-1', 'state-1', SOURCE)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects state without the expected subject, purpose, intent, or nonce', async () => {
    mockJwt.verifyAsync.mockResolvedValue({
      sub: 'u1',
      purpose: 'oauth_state',
      intent: 'LOGIN',
      provider: 'GOOGLE',
      nonce: 'nonce',
    });

    await expect(useCase.execute('code-1', 'state-1', SOURCE)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(axiosPostFn).not.toHaveBeenCalled();
  });

  it('requires explicit consent for an invite and binds it to the provider email', async () => {
    mockJwt.verifyAsync.mockResolvedValue({
      ...STATE,
      intent: 'INVITE',
      inviteEmail: 'alice@example.com',
      inviteId: 'invite-1',
      inviteTokenHash: 'invite-hash',
    });

    const result = await useCase.execute('code-1', 'state-1', SOURCE);

    expect(mockPrisma.invite.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'invite-1',
        email: 'alice@example.com',
        tokenHash: 'invite-hash',
        usedAt: null,
        expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      },
    });
    expect(mockSignup.createProviderConsentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteId: 'invite-1',
        inviteTokenHash: 'invite-hash',
        userId: 'u1',
      }),
    );
    expect(mockLogin.execute).not.toHaveBeenCalled();
    expect(result).toMatchObject({ consentRequired: true });
  });

  it('does not allow an unverified provider email to accept an invite', async () => {
    mockJwt.verifyAsync.mockResolvedValue({
      ...STATE,
      intent: 'INVITE',
      inviteEmail: 'alice@example.com',
      inviteId: 'invite-1',
      inviteTokenHash: 'invite-hash',
    });
    mockDiscovery.verifyIdToken.mockResolvedValue({
      sub: 'provider-subject',
      email: 'alice@example.com',
      email_verified: false,
      nonce: 'nonce-1',
    });

    await expect(useCase.execute('code-1', 'state-1', SOURCE)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockPrisma.invite.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an email mismatch for an explicitly initiated invite flow', async () => {
    mockJwt.verifyAsync.mockResolvedValue({
      ...STATE,
      intent: 'INVITE',
      inviteEmail: 'other@example.com',
      inviteId: 'invite-1',
      inviteTokenHash: 'invite-hash',
    });

    await expect(useCase.execute('code-1', 'state-1', SOURCE)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockSignup.createProviderConsentIntent).not.toHaveBeenCalled();
    expect(mockLogin.execute).not.toHaveBeenCalled();
  });

  it('completes the consent-bound signup before asking for session tokens', async () => {
    mockSignup.completeProviderConsent.mockResolvedValue({
      user: { id: 'new-user', email: 'new@example.com', roleId: 'role-user' },
      callbackUrl: '/dashboard',
    });

    const result = await useCase.completeSignup('intent.secret', true, SOURCE);

    expect(mockSignup.completeProviderConsent).toHaveBeenCalledWith({
      token: 'intent.secret',
      acceptTerms: true,
    });
    expect(mockLogin.execute).toHaveBeenCalledWith(
      { id: 'new-user', email: 'new@example.com' },
      SOURCE,
    );
    expect(result).toMatchObject({ callbackUrl: '/dashboard' });
  });

  it('uses the same redirect URI for authorization-code exchange', async () => {
    await useCase.execute('code-1', 'state-1', SOURCE);

    const body = axiosPostFn.mock.calls[0][1] as URLSearchParams;
    expect(axiosPostFn.mock.calls[0][0]).toBe(
      'https://oauth2.googleapis.com/token',
    );
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code-1');
    expect(body.get('redirect_uri')).toBe(
      'https://app.example.com/api/auth/oauth/callback',
    );
    expect(body.get('client_secret')).toBe('secret-456');
  });
});
