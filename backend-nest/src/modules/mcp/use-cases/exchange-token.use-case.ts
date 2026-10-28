import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { McpTokenService, type IssuedTokens } from '../mcp-token.service';
import { OAuthError } from '../oauth-error';

export interface TokenRequest {
  grant_type?: string;
  code?: string;
  code_verifier?: string;
  client_id?: string;
  redirect_uri?: string;
  refresh_token?: string;
}

@Injectable()
export class ExchangeTokenUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: McpTokenService,
  ) {}

  // `async` de propósito: o `throw` do default precisa virar rejeição, senão quem
  // chamar com `.catch()` (e não `await`) toma a exceção solta.
  async execute(body: TokenRequest): Promise<IssuedTokens> {
    switch (body.grant_type) {
      case 'authorization_code':
        return this.byCode(body);
      case 'refresh_token':
        return this.byRefresh(body);
      default:
        throw new OAuthError(
          'unsupported_grant_type',
          `grant_type não suportado: ${body.grant_type ?? '(ausente)'}`,
        );
    }
  }

  private async byCode(body: TokenRequest): Promise<IssuedTokens> {
    if (!body.code || !body.code_verifier) {
      throw new OAuthError(
        'invalid_request',
        'code e code_verifier são obrigatórios',
      );
    }

    const grant = await this.prisma.oAuthGrant.findUnique({
      where: { codeHash: this.tokens.hash(body.code) },
    });

    // Code já resgatado cai aqui também: issueTokens zera o codeHash, então a
    // segunda tentativa não encontra linha nenhuma (single-use de fato).
    if (!grant || grant.revokedAt) {
      throw new OAuthError('invalid_grant', 'code inválido ou já utilizado');
    }

    if (!grant.codeExpiresAt || grant.codeExpiresAt < new Date()) {
      throw new OAuthError('invalid_grant', 'code expirado');
    }

    if (body.client_id && body.client_id !== grant.clientId) {
      throw new OAuthError(
        'invalid_grant',
        'code não pertence a este client_id',
      );
    }

    // Repetir a redirect_uri no /token é exigência do RFC 6749 §4.1.3 quando ela
    // foi usada no /authorize — impede troca de code entre redirects do cliente.
    if (body.redirect_uri && body.redirect_uri !== grant.redirectUri) {
      throw new OAuthError('invalid_grant', 'redirect_uri não confere');
    }

    if (
      !grant.codeChallenge ||
      !this.tokens.safeEqual(
        this.tokens.s256(body.code_verifier),
        grant.codeChallenge,
      )
    ) {
      throw new OAuthError('invalid_grant', 'code_verifier não confere (PKCE)');
    }

    return this.tokens.issueTokens(grant.id, grant.scopes);
  }

  private async byRefresh(body: TokenRequest): Promise<IssuedTokens> {
    if (!body.refresh_token) {
      throw new OAuthError('invalid_request', 'refresh_token é obrigatório');
    }

    const grant = await this.prisma.oAuthGrant.findUnique({
      where: { refreshHash: this.tokens.hash(body.refresh_token) },
    });

    if (!grant || grant.revokedAt) {
      throw new OAuthError('invalid_grant', 'refresh_token inválido');
    }

    if (!grant.refreshExpiresAt || grant.refreshExpiresAt < new Date()) {
      throw new OAuthError('invalid_grant', 'refresh_token expirado');
    }

    if (body.client_id && body.client_id !== grant.clientId) {
      throw new OAuthError(
        'invalid_grant',
        'refresh_token não pertence a este client_id',
      );
    }

    // Rotaciona access token e refresh token (OAuth 2.1 §4.14).
    return this.tokens.issueTokens(grant.id, grant.scopes);
  }

  /** RFC 7009: sempre responde 200, mesmo para token que não existe. */
  async revoke(token?: string): Promise<void> {
    if (!token) return;
    const hash = this.tokens.hash(token);
    await this.prisma.oAuthGrant.updateMany({
      where: {
        OR: [{ accessHash: hash }, { refreshHash: hash }],
        revokedAt: null,
      },
      data: { revokedAt: new Date(), accessHash: null, refreshHash: null },
    });
  }
}
