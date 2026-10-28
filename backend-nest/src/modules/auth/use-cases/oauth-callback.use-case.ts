import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { JWTPayload } from 'jose';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { OauthProvidersUseCase } from './oauth-providers.use-case';
import { OidcDiscoveryService } from '../oidc-discovery.service';
import { LoginUseCase } from './login.use-case';
import { SignupUseCase } from './signup.use-case';
import { UserStatusConst } from '../../../domain/auth/userStatus.const';
import type { RequestSource } from '../../../common/utils/request-source.util';
import {
  OAUTH_INTENTS,
  OAUTH_STATE_PURPOSE,
  OAUTH_STATE_SUB,
  oauthRedirectUri,
  type OauthIntent,
} from '../../../domain/auth/oauthProvider.const';

interface OauthState {
  sub?: string;
  purpose?: string;
  intent?: OauthIntent;
  provider?: string;
  callbackUrl?: string;
  nonce?: string;
  inviteEmail?: string;
  inviteId?: string;
  inviteTokenHash?: string;
}

interface TokenResponse {
  id_token?: string;
}

@Injectable()
export class OauthCallbackUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: OauthProvidersUseCase,
    private readonly discovery: OidcDiscoveryService,
    private readonly login$: LoginUseCase,
    private readonly signup: SignupUseCase,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async execute(code: string, state: string, source: RequestSource) {
    const parsedState = await this.verifyState(state);
    const provider = await this.providers.getConfiguredOrThrow(
      parsedState.provider!,
    );
    const { tokenEndpoint } = await this.discovery.discover(provider.issuer);
    const idToken = await this.exchangeCode(
      tokenEndpoint,
      code,
      provider.clientId,
      provider.clientSecret,
    );

    let claims: JWTPayload;
    try {
      claims = await this.discovery.verifyIdToken(
        provider.issuer,
        idToken,
        provider.clientId,
      );
    } catch {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }

    const email =
      typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    if (
      !claims.sub ||
      claims.nonce !== parsedState.nonce ||
      !email ||
      claims.email_verified !== true
    ) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }

    if (
      parsedState.intent === 'INVITE' &&
      parsedState.inviteEmail?.trim().toLowerCase() !== email
    ) {
      throw new UnauthorizedException(
        this.i18n.t('auth.invite.email_mismatch'),
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (parsedState.intent === 'INVITE') {
      const invite = await this.prisma.invite.findFirst({
        where: {
          id: parsedState.inviteId,
          email,
          tokenHash: parsedState.inviteTokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!invite) {
        throw new UnauthorizedException(
          this.i18n.t('auth.invite.invalid_token'),
        );
      }
      if (
        existing &&
        (existing.deletedAt !== null ||
          existing.status !== UserStatusConst.ACTIVE)
      ) {
        throw new UnauthorizedException(
          this.i18n.t('auth.login.user_not_active'),
        );
      }

      const signupToken = await this.signup.createProviderConsentIntent({
        email,
        name: typeof claims.name === 'string' ? claims.name : undefined,
        providerId: provider.id,
        callbackUrl: parsedState.callbackUrl,
        inviteId: invite.id,
        inviteTokenHash: parsedState.inviteTokenHash,
        userId: existing?.id,
      });
      return {
        consentRequired: true,
        signupIntent: 'INVITE' as const,
        signupToken,
        providerId: provider.id,
        callbackUrl: parsedState.callbackUrl,
      };
    }

    if (existing) {
      if (
        existing.deletedAt !== null ||
        existing.status !== UserStatusConst.ACTIVE
      ) {
        throw new UnauthorizedException(
          this.i18n.t('auth.login.user_not_active'),
        );
      }
      const tokens = await this.login$.execute(
        { id: existing.id, email: existing.email },
        source,
      );
      return {
        tokens,
        user: {
          id: existing.id,
          email: existing.email,
          roleId: existing.roleId,
        },
        callbackUrl: parsedState.callbackUrl,
      };
    }

    if (!(await this.signup.isAutonomousSignupAvailable())) {
      throw new UnauthorizedException(
        this.i18n.t('auth.login.invalid_credentials'),
      );
    }

    const signupToken = await this.signup.createProviderConsentIntent({
      email,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      providerId: provider.id,
      callbackUrl: parsedState.callbackUrl,
    });
    return {
      consentRequired: true,
      signupIntent: 'SIGNUP' as const,
      signupToken,
      providerId: provider.id,
      callbackUrl: parsedState.callbackUrl,
    };
  }

  async completeSignup(
    token: string,
    acceptTerms: boolean,
    source: RequestSource,
  ) {
    const completion = await this.signup.completeProviderConsent({
      token,
      acceptTerms,
    });
    const tokens = await this.login$.execute(
      { id: completion.user.id, email: completion.user.email },
      source,
    );
    return {
      tokens,
      user: {
        id: completion.user.id,
        email: completion.user.email,
        roleId: completion.user.roleId,
      },
      callbackUrl: completion.callbackUrl,
    };
  }

  private async verifyState(state: string): Promise<OauthState> {
    let payload: OauthState;
    try {
      payload = await this.jwtService.verifyAsync<OauthState>(state, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }
    if (
      payload.sub !== OAUTH_STATE_SUB ||
      payload.purpose !== OAUTH_STATE_PURPOSE ||
      !payload.provider ||
      !payload.nonce ||
      !payload.intent ||
      !OAUTH_INTENTS.includes(payload.intent)
    ) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }
    if (
      payload.intent === 'INVITE' &&
      (!payload.inviteEmail || !payload.inviteId || !payload.inviteTokenHash)
    ) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }
    return payload;
  }

  private async exchangeCode(
    tokenEndpoint: string,
    code: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    let data: TokenResponse;
    try {
      const response = await axios.post<TokenResponse>(
        tokenEndpoint,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: oauthRedirectUri(
            this.configService.get<string>('NEXTAUTH_URL'),
          ),
          client_id: clientId,
          client_secret: clientSecret,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        },
      );
      data = response.data;
    } catch {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }

    if (!data?.id_token) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }
    return data.id_token;
  }
}
