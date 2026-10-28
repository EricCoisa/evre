import type { NextRequest } from 'next/server';

/** Proxy do conector MCP: expõe `/mcp`, `/oauth/*` e `/.well-known/*` no domínio do front e repassa ao backend. */

/** URL interna da API. `NEXT_PUBLIC_API_URL` é a que o docker-compose define. */
const API =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api/v1';

/** Raiz do backend, sem `/api/v1` — os `.well-known` moram lá (RFCs os ancoram na raiz). */
const API_ROOT = API.replace(/\/api\/v1\/?$/, '');

/** Headers repassados ao backend; `x-forwarded-for` mantém o throttle no IP do cliente real. */
const REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'mcp-protocol-version',
  'x-forwarded-for',
  // Assinatura do webhook da Meta. Header não repassado = assinatura que nunca chega,
  // e todo inbound seria rejeitado. Ver docs/backend/messaging.md.
  'x-hub-signature-256',
];

/** Headers devolvidos ao cliente; `www-authenticate` carrega o `resource_metadata` que inicia o login. */
const RESPONSE_HEADERS = [
  'content-type',
  'www-authenticate',
  'cache-control',
  'location',
];

/** Resolve a origem pública (host + proto) em que este proxy foi acessado. */
function publicOrigin(req: NextRequest): string {
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0].trim() ||
    req.headers.get('host');
  if (!host) return req.nextUrl.origin;

  const proto =
    req.headers.get('x-forwarded-proto')?.split(',')[0].trim() ||
    req.nextUrl.protocol.replace(':', '');

  return `${proto}://${host}`;
}

export async function proxyToBackend(
  req: NextRequest,
  target: string,
): Promise<Response> {
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-mcp-public-origin', publicOrigin(req));

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  let backendRes: Response;
  try {
    backendRes = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.text() : undefined,
      // `manual`: o /authorize responde 302 para a tela de consentimento. Seguindo
      // o redirect aqui, o cliente receberia o HTML da página em vez do 302.
      redirect: 'manual',
      cache: 'no-store',
      signal: req.signal,
    });
  } catch {
    // Backend fora do ar: 502 é a verdade. Um 500 faria o cliente culpar o protocolo.
    return Response.json(
      { error: 'server_error', error_description: 'Backend unreachable' },
      { status: 502 },
    );
  }

  const out = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = backendRes.headers.get(name);
    if (value) out.set(name, value);
  }

  // 204/304 não podem ter corpo — construir um Response com body aqui estoura.
  const body =
    backendRes.status === 204 || backendRes.status === 304
      ? null
      : await backendRes.arrayBuffer();

  return new Response(body, { status: backendRes.status, headers: out });
}

/** Alvo sob o prefixo versionado da API (`/api/v1/...`). */
export const apiTarget = (path: string, search = '') => `${API}${path}${search}`;

/** Alvo na raiz do backend, fora do prefixo (`/.well-known/...`). */
export const rootTarget = (path: string, search = '') =>
  `${API_ROOT}${path}${search}`;
