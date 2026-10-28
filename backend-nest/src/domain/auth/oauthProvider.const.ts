/** Registro dos providers OAuth/OIDC suportados. */
export const OAuthProviders = [
  { id: 'GOOGLE', label: 'Google' },
  { id: 'MICROSOFT', label: 'Microsoft' },
] as const;

export type OAuthProviderId = (typeof OAuthProviders)[number]['id'];

/** Chaves em SystemConfiguration que descrevem um provider. */
export const oauthConfigKeys = (id: string) => ({
  issuer: `SYSTEM_OAUTH_${id}_ISSUER`,
  clientId: `SYSTEM_OAUTH_${id}_CLIENT_ID`,
  clientSecret: `SYSTEM_OAUTH_${id}_CLIENT_SECRET`,
  /** Liga/desliga o provider no login sem apagar as 3 chaves acima. */
  enabled: `SYSTEM_OAUTH_${id}_ENABLED`,
});

/** Flag que liga/desliga o recurso inteiro. Ver docs/backend/feature-flags-backend.md. */
export const OAUTH_FEATURE_FLAG = 'OAUTH_LOGIN';

/** Escopos OIDC mínimos — os mesmos em qualquer provider compatível. */
export const OAUTH_SCOPES = 'openid email profile';

/** `sub` fixo do state; reapresentá-lo como access_token cai em 401 na JwtStrategy. */
export const OAUTH_STATE_SUB = 'oauth-state';
export const OAUTH_STATE_PURPOSE = 'oauth_state';
export const OAUTH_STATE_TTL = '10m';
export const OAUTH_INTENTS = ['LOGIN', 'SIGNUP', 'INVITE'] as const;
export type OauthIntent = (typeof OAUTH_INTENTS)[number];

/** Monta o `redirect_uri` do OAuth apontando para o frontend, não para o backend. */
export const oauthRedirectUri = (frontendUrl?: string) =>
  `${(frontendUrl ?? '').replace(/\/$/, '')}/api/auth/oauth/callback`;
