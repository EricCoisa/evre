/** Chaves em SystemConfiguration que descrevem o Sentry. */
export const sentryConfigKeys = {
  /** Liga/desliga o Sentry independente do DSN configurado no ambiente. */
  enabled: 'SYSTEM_SENTRY_ENABLED',
  dsn: 'SYSTEM_SENTRY_DSN',
} as const;

/** Extrai publicKey, projectId e envelopeUrl de um DSN do Sentry; `null` se o formato não bater. */
export function parseSentryDsn(dsn: string): {
  publicKey: string;
  projectId: string;
  envelopeUrl: string;
} | null {
  let url: URL;
  try {
    url = new URL(dsn.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.username) return null;

  // O projectId é o ÚLTIMO segmento; o que vem antes é o path opcional de
  // instalações self-hosted servidas numa subpasta.
  const segments = url.pathname.split('/').filter(Boolean);
  const projectId = segments.pop();
  if (!projectId || !/^\d+$/.test(projectId)) return null;

  const prefix = segments.length ? `/${segments.join('/')}` : '';
  return {
    publicKey: url.username,
    projectId,
    envelopeUrl: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/?sentry_key=${url.username}&sentry_version=7`,
  };
}
