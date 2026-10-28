import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from 'src/prisma/prisma.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { McpScopes, type McpScope } from 'src/domain/api-key/mcp-scopes.const';
import {
  OAUTH_TOKEN_PREFIX,
  OAUTH_TTL_SECONDS,
} from 'src/domain/mcp/mcp.const';
import { LoggingService } from '../../logging/logging.service';
import { McpTokenService } from '../mcp-token.service';
import { OAuthError } from '../oauth-error';

export interface AuthorizeQuery {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
  resource?: string;
}

/** Params validados do /authorize, assinados e devolvidos ao browser. */
interface PendingAuthz {
  cid: string;
  uri: string;
  chal: string;
  st?: string;
  scope: string[];
}

const ALL_SCOPES = Object.values(McpScopes) as McpScope[];

@Injectable()
export class AuthorizeUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tokens: McpTokenService,
    private readonly loggingService: LoggingService,
  ) {}

  /** Valida o pedido de autorização e devolve a URL da tela de consentimento no front. */
  async start(query: AuthorizeQuery, publicOrigin: string): Promise<string> {
    if (query.response_type !== 'code') {
      throw new OAuthError(
        'invalid_request',
        'response_type deve ser "code" (só authorization code é suportado)',
      );
    }

    if (!query.client_id) {
      throw new OAuthError('invalid_request', 'client_id é obrigatório');
    }

    const client = await this.prisma.oAuthClient.findUnique({
      where: { id: query.client_id },
    });
    if (!client) {
      throw new OAuthError('invalid_client', 'client_id desconhecido');
    }

    // Match EXATO contra o que foi registrado. É a única defesa real contra
    // redirecionar o code para um endereço de terceiro (OAuth 2.1 §4.1.3).
    if (
      !query.redirect_uri ||
      !client.redirectUris.includes(query.redirect_uri)
    ) {
      throw new OAuthError(
        'invalid_request',
        'redirect_uri não confere com nenhuma das registradas para este client_id',
      );
    }

    // PKCE obrigatório, só S256: "plain" não protege nada num cliente público.
    if (!query.code_challenge || query.code_challenge_method !== 'S256') {
      throw new OAuthError(
        'invalid_request',
        'code_challenge com code_challenge_method=S256 é obrigatório',
      );
    }

    const pending: PendingAuthz = {
      cid: client.id,
      uri: query.redirect_uri,
      chal: query.code_challenge,
      st: query.state,
      scope: this.parseScopes(query.scope),
    };

    const req = await this.signPending(pending);

    // Consentimento na mesma origem em que o fluxo começou, para a sessão não nascer em outro domínio.
    return `${publicOrigin}/profile/connect?req=${encodeURIComponent(req)}`;
  }

  /** Dados que a tela de consentimento mostra: quem está pedindo e o quê. */
  async describe(req: string) {
    const pending = await this.verifyPending(req);
    const client = await this.prisma.oAuthClient.findUnique({
      where: { id: pending.cid },
      select: { id: true, name: true },
    });
    if (!client) {
      throw new OAuthError('invalid_client', 'client_id desconhecido');
    }

    return {
      clientId: client.id,
      clientName: client.name,
      redirectUri: pending.uri,
      /** Scopes pedidos pelo cliente (vazio = o cliente deixou o usuário escolher). */
      requestedScopes: pending.scope,
      /** Vocabulário completo, para a tela poder oferecer mais do que foi pedido. */
      availableScopes: ALL_SCOPES,
    };
  }

  /** Cria a conexão com um authorization code de uso único e devolve a URL de retorno ao cliente. */
  async approve(req: string, scopes: string[], userId: string) {
    const pending = await this.verifyPending(req);

    const granted = scopes.filter((s): s is McpScope =>
      (ALL_SCOPES as string[]).includes(s),
    );
    const unknown = scopes.filter((s) => !(ALL_SCOPES as string[]).includes(s));
    if (unknown.length) {
      throw new OAuthError(
        'invalid_scope',
        `scope desconhecido: ${unknown.join(', ')}`,
      );
    }

    const code = this.tokens.generate(OAUTH_TOKEN_PREFIX.CODE);

    const grant = await this.prisma.oAuthGrant.create({
      data: {
        clientId: pending.cid,
        userId,
        scopes: granted,
        codeHash: this.tokens.hash(code),
        codeChallenge: pending.chal,
        redirectUri: pending.uri,
        codeExpiresAt: new Date(Date.now() + OAUTH_TTL_SECONDS.CODE * 1000),
      },
      include: { client: { select: { name: true } } },
    });

    await this.loggingService.create(
      {
        module: 'MCP',
        action: LogActions.MCP_CONNECTED,
        message: `Conector MCP autorizado: ${grant.client.name}`,
        metadata: { grantId: grant.id, clientId: pending.cid, scopes: granted },
      },
      userId,
    );

    const redirect = new URL(pending.uri);
    redirect.searchParams.set('code', code);
    // `state` volta intocado — é o anti-CSRF do cliente (RFC 6749 §10.12).
    if (pending.st) redirect.searchParams.set('state', pending.st);

    return { redirectTo: redirect.toString() };
  }

  /** Deriva o segredo do JWT_SECRET com sufixo próprio para assinar o pedido de autorização pendente. */
  private get pendingSecret(): string {
    return `${this.config.get<string>('JWT_SECRET') ?? ''}:mcp-authz-request`;
  }

  private signPending(pending: PendingAuthz): Promise<string> {
    return this.jwt.signAsync(pending, {
      secret: this.pendingSecret,
      expiresIn: '10m',
    });
  }

  private async verifyPending(req: string): Promise<PendingAuthz> {
    try {
      return await this.jwt.verifyAsync<PendingAuthz>(req, {
        secret: this.pendingSecret,
      });
    } catch {
      throw new OAuthError(
        'invalid_request',
        'Pedido de autorização inválido ou expirado — reinicie a conexão no cliente',
      );
    }
  }

  /** `scope` é string separada por espaço (RFC 6749 §3.3); ignora o que não conhecemos. */
  private parseScopes(raw?: string): McpScope[] {
    if (!raw) return [];
    return raw
      .split(/[\s+]+/)
      .filter(Boolean)
      .filter((s): s is McpScope => (ALL_SCOPES as string[]).includes(s));
  }
}
