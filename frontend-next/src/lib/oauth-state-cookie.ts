/** Cookie que amarra o state do OAuth ao browser que iniciou o fluxo, prevenindo CSRF de login. */
export const OAUTH_STATE_COOKIE = 'oauth_state';

// `lax`, não `strict`: o callback chega por navegação top-level vinda do provider,
// e um cookie `strict` não seria enviado nesse redirect cross-site.
export const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/api/auth/oauth',
} as const;

/** Mesma validade do state assinado no backend (OAUTH_STATE_TTL). */
export const OAUTH_STATE_MAX_AGE = 600;
