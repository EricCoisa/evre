import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { LoggingService } from '../../logging/logging.service';
import { OAuthError } from '../oauth-error';

/** Implementa Dynamic Client Registration (RFC 7591) para o conector MCP. */
@Injectable()
export class RegisterClientUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(body: Record<string, unknown>) {
    const redirectUris = this.parseRedirectUris(body.redirect_uris);
    const name = this.parseName(body.client_name);

    const client = await this.prisma.oAuthClient.create({
      data: { name, redirectUris },
    });

    // performedById null: DCR é anônimo por definição — nenhum usuário autenticou
    // ainda neste ponto do fluxo.
    await this.loggingService.create(
      {
        module: 'MCP',
        action: LogActions.MCP_CLIENT_REGISTERED,
        message: `Cliente MCP registrado: ${name}`,
        metadata: { clientId: client.id, redirectUris },
      },
      null,
    );

    return {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      // Cliente público + PKCE obrigatório: um app desktop não tem onde guardar
      // um secret, então emitir um seria segurança de fachada (OAuth 2.1 §7.1).
      token_endpoint_auth_method: 'none',
    };
  }

  private parseName(raw: unknown): string {
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name) return 'Cliente MCP';
    return name.slice(0, 100);
  }

  private parseRedirectUris(raw: unknown): string[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new OAuthError(
        'invalid_redirect_uri',
        'redirect_uris é obrigatório',
      );
    }

    return raw.map((entry) => {
      if (typeof entry !== 'string') {
        throw new OAuthError('invalid_redirect_uri', 'redirect_uri inválida');
      }

      let url: URL;
      try {
        url = new URL(entry);
      } catch {
        throw new OAuthError(
          'invalid_redirect_uri',
          `redirect_uri não é uma URL absoluta: ${entry}`,
        );
      }

      // RFC 6749 §3.1.2: fragmento é proibido — o code iria para o fragmento e
      // jamais chegaria ao servidor do cliente.
      if (url.hash) {
        throw new OAuthError(
          'invalid_redirect_uri',
          'redirect_uri não pode ter fragmento (#)',
        );
      }

      // http:// só em loopback (OAuth 2.1 §2.3.1) — é o caso do Claude Code, que
      // sobe um listener local. Qualquer outro http seria texto claro na rede.
      if (url.protocol === 'http:' && !isLoopback(url.hostname)) {
        throw new OAuthError(
          'invalid_redirect_uri',
          'redirect_uri http:// só é aceita em loopback (127.0.0.1 / localhost)',
        );
      }

      return url.toString();
    });
  }
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}
