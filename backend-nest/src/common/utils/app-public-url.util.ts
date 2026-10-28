import type { Request } from 'express';

/** Header com que o proxy do front informa em que domínio público ele foi acessado. */
export const MCP_PUBLIC_ORIGIN_HEADER = 'x-mcp-public-origin';

/** URL pública do app (domínio do frontend, sem barra final), derivada do header do proxy ou de `NEXTAUTH_URL`. */
export function appPublicUrl(req?: Request): string {
  const forwarded = req?.get(MCP_PUBLIC_ORIGIN_HEADER);
  if (forwarded) {
    const origin = parseOrigin(forwarded);
    if (origin) return origin;
  }

  return stripTrailingSlash(
    process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  );
}

/** Devolve o `origin` de uma URL http(s) bem formada, sem path, query nem credenciais. */
function parseOrigin(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
