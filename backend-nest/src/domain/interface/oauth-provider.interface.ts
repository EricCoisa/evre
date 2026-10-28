import type { ProviderResult } from './provider-result';

/** Credenciais de um provider OAuth já resolvidas (issuer → tokenEndpoint via OIDC Discovery). */
export interface OAuthCredentials {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
}

/** Valida a configuração contra o serviço real antes de gravar, como os demais providers. */
export interface IOAuthProvider {
  validateConfiguration(): Promise<ProviderResult>;
}

export interface IOAuthService {
  use(credentials: OAuthCredentials): IOAuthProvider;
}
