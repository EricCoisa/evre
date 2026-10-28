import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { PrismaService } from 'src/prisma/prisma.service';
import {
  OAUTH_TOKEN_PREFIX,
  OAUTH_TTL_SECONDS,
} from 'src/domain/mcp/mcp.const';

export interface McpPrincipal {
  user: {
    id: string;
    email: string;
    roleId: string | null;
    roleName: string;
  };
  scopes: string[];
  grantId: string;
}

export interface IssuedTokens {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

@Injectable()
export class McpTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Só o hash é persistido — o valor cru existe apenas na resposta HTTP. */
  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  generate(prefix: string): string {
    return prefix + randomBytes(32).toString('base64url');
  }

  /** Comparação de segredo em tempo constante (PKCE, client_secret). */
  safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  /** `code_verifier` → `code_challenge` do PKCE S256 (RFC 7636 §4.2). */
  s256(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  /** Emite ou rotaciona o par access/refresh da conexão; o access é opaco e guardado como hash. */
  async issueTokens(grantId: string, scopes: string[]): Promise<IssuedTokens> {
    const accessToken = this.generate(OAUTH_TOKEN_PREFIX.ACCESS);
    const refreshToken = this.generate(OAUTH_TOKEN_PREFIX.REFRESH);
    const now = Date.now();

    await this.prisma.oAuthGrant.update({
      where: { id: grantId },
      data: {
        // O code morre aqui: single-use, e sem isto um code vazado seria resgatável de novo.
        codeHash: null,
        codeChallenge: null,
        codeExpiresAt: null,
        accessHash: this.hash(accessToken),
        accessExpiresAt: new Date(now + OAUTH_TTL_SECONDS.ACCESS * 1000),
        refreshHash: this.hash(refreshToken),
        refreshExpiresAt: new Date(now + OAUTH_TTL_SECONDS.REFRESH * 1000),
      },
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: OAUTH_TTL_SECONDS.ACCESS,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    };
  }

  /** Resolve um Bearer token em usuário e scopes aprovados, ou null se inválido por qualquer motivo. */
  async validateAccessToken(raw: string): Promise<McpPrincipal | null> {
    const grant = await this.prisma.oAuthGrant.findUnique({
      where: { accessHash: this.hash(raw) },
      include: {
        user: { include: { roleRecord: { select: { name: true } } } },
      },
    });

    if (!grant || grant.revokedAt) return null;
    if (!grant.accessExpiresAt || grant.accessExpiresAt < new Date())
      return null;

    // Mesma regra da JwtStrategy/ApiKeyStrategy: dono inativo invalida o token.
    if (grant.user.deletedAt !== null || grant.user.status !== 'ACTIVE')
      return null;

    // Best-effort: não bloqueia a request (padrão do ApiKeyService.validateKey).
    void this.prisma.oAuthGrant
      .update({ where: { id: grant.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return {
      user: {
        id: grant.user.id,
        email: grant.user.email,
        roleId: grant.user.roleId ?? null,
        roleName: grant.user.roleRecord?.name ?? 'USER',
      },
      scopes: grant.scopes,
      grantId: grant.id,
    };
  }
}
