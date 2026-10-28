import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  IOAuthProvider,
  IOAuthService,
  OAuthCredentials,
} from 'src/domain/interface/oauth-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import { oauthRedirectUri } from 'src/domain/auth/oauthProvider.const';

/** Erros de autenticação do cliente no token endpoint (RFC 6749 §5.2) que significam "clientId/clientSecret errados". */
const CLIENT_AUTH_ERRORS = ['invalid_client', 'unauthorized_client'];

interface TokenErrorResponse {
  error?: string;
  error_description?: string;
}

/** Valida credenciais OAuth contra o provider real, devolvendo um `ProviderResult`. */
@Injectable()
export class OAuthProviderService implements IOAuthService {
  private readonly logger = new Logger(OAuthProviderService.name);

  constructor(private readonly configService: ConfigService) {}

  use(cfg: OAuthCredentials): IOAuthProvider {
    return { validateConfiguration: () => this.probe(cfg) };
  }

  /** Troca um `code` propositalmente inválido no token endpoint para verificar as credenciais. */
  private async probe(cfg: OAuthCredentials): Promise<ProviderResult> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'invalid-code-credential-probe',
      redirect_uri: oauthRedirectUri(
        this.configService.get<string>('NEXTAUTH_URL'),
      ),
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });

    let payload: TokenErrorResponse;
    try {
      await axios.post(cfg.tokenEndpoint, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });
      // 2xx com um code falso não deveria acontecer; se acontecer, a credencial passou.
      return { status: true, data: 'Credenciais válidas' };
    } catch (error) {
      const response = axios.isAxiosError(error) ? error.response : undefined;
      if (!response) {
        const message = (error as Error)?.message ?? String(error);
        this.logger.error(`[OAuth] Token endpoint inacessível: ${message}`);
        return {
          status: false,
          data: `Não foi possível falar com o token endpoint do provider: ${message}`,
        };
      }
      payload = (response.data ?? {}) as TokenErrorResponse;
    }

    if (payload.error && CLIENT_AUTH_ERRORS.includes(payload.error)) {
      this.logger.warn(`[OAuth] Credenciais recusadas: ${payload.error}`);
      return {
        status: false,
        data:
          payload.error_description ??
          'Client ID ou Client Secret recusados pelo provider',
      };
    }

    return { status: true, data: 'Credenciais válidas' };
  }
}
