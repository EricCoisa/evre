import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { UnauthorizedException } from '@nestjs/common';
import { OauthProvidersUseCase } from './oauth-providers.use-case';
import { GenerateInviteUseCase } from './generate-invite.use-case';
import { SignupUseCase } from './signup.use-case';
import { OidcDiscoveryService } from '../oidc-discovery.service';
import {
  OAUTH_SCOPES,
  OAUTH_STATE_PURPOSE,
  OAUTH_STATE_SUB,
  OAUTH_STATE_TTL,
  type OauthIntent,
  oauthRedirectUri,
} from '../../../domain/auth/oauthProvider.const';

/** Rejeita destino não-relativo e protocol-relative, para impedir open redirect no fim do fluxo. */
function safeCallbackUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('://')) {
    return undefined;
  }
  return url;
}

@Injectable()
export class OauthAuthorizeUrlUseCase {
  constructor(
    private readonly providers: OauthProvidersUseCase,
    private readonly generateInvite$: GenerateInviteUseCase,
    private readonly discovery: OidcDiscoveryService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly signup: SignupUseCase,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    providerId: string,
    callbackUrl?: string,
    inviteToken?: string,
    requestedIntent: OauthIntent = 'LOGIN',
  ) {
    const provider = await this.providers.getConfiguredOrThrow(providerId);

    // Convite validado na entrada; o state recebe só o hash, nunca o token bearer.
    const invitePayload = inviteToken
      ? await this.generateInvite$.validateInviteToken(inviteToken)
      : null;
    const intent: OauthIntent = invitePayload ? 'INVITE' : requestedIntent;
    if (
      intent === 'SIGNUP' &&
      !(await this.signup.isAutonomousSignupAvailable())
    ) {
      throw new UnauthorizedException(
        this.i18n.t('auth.login.invalid_credentials'),
      );
    }
    if (intent === 'INVITE' && !invitePayload) {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }

    const { authorizationEndpoint } = await this.discovery.discover(
      provider.issuer,
    );

    const nonce = randomUUID();
    // State stateless: JWT assinado carrega provider + destino + nonce. Sem Redis,
    // sem sessão, funciona com múltiplas instâncias do backend.
    const state = await this.jwtService.signAsync(
      {
        sub: OAUTH_STATE_SUB,
        purpose: OAUTH_STATE_PURPOSE,
        intent,
        provider: provider.id,
        callbackUrl: safeCallbackUrl(callbackUrl),
        nonce,
        inviteEmail: invitePayload?.email,
        inviteId: invitePayload?.inviteId,
        inviteTokenHash: invitePayload?.tokenHash,
      },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: OAUTH_STATE_TTL,
      },
    );

    const url = new URL(authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', provider.clientId);
    url.searchParams.set(
      'redirect_uri',
      oauthRedirectUri(this.configService.get<string>('NEXTAUTH_URL')),
    );
    url.searchParams.set('scope', OAUTH_SCOPES);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);

    return { url: url.toString() };
  }
}
