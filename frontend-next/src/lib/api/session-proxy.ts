import type { NextRequest } from 'next/server';
import {
  getServerAccessToken,
  getServerLang,
  getServerRefreshToken,
} from '@/lib/actions/auth/server-auth';
import { apiTarget } from '@/lib/api/mcp-proxy';
import { refreshSession } from '@/lib/api/session-refresh';

/** Repassa uma request do navegador ao backend convertendo o cookie de sessão em Bearer, em stream. */
async function requestHeaders(
  req: NextRequest,
  token: string,
  forwardBody: boolean,
): Promise<Headers> {
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const forwarded: Array<[string, string | null | undefined]> = [
    ['Accept-Language', await getServerLang()],
    // <audio>/<video> avançam pedindo trechos; sem repassar, o seek recomeça do zero.
    ['Range', req.headers.get('range')],
    ['Content-Type', forwardBody ? req.headers.get('content-type') : null],
  ];
  for (const [name, value] of forwarded) if (value) headers.set(name, value);
  return headers;
}

function responseHeaders(from: Headers): Headers {
  const out = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = from.get(name);
    if (value) out.set(name, value);
  }
  return out;
}

async function fetchBackend(
  req: NextRequest,
  path: string,
  token: string,
  forwardBody: boolean,
): Promise<Response> {
  try {
    return await fetch(apiTarget(path), {
      method: req.method,
      headers: await requestHeaders(req, token, forwardBody),
      body: forwardBody ? req.body : undefined,
      // Node exige `duplex` para enviar um ReadableStream como corpo.
      ...(forwardBody ? ({ duplex: 'half' } as object) : {}),
      cache: 'no-store',
      signal: req.signal,
    });
  } catch {
    return Response.json({ message: 'Backend unreachable' }, { status: 502 });
  }
}

function toResponse(backendRes: Response): Response {
  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: responseHeaders(backendRes.headers),
  });
}

export async function proxyWithSession(
  req: NextRequest,
  path: string,
  { forwardBody = false }: { forwardBody?: boolean } = {},
): Promise<Response> {
  const token = await getServerAccessToken();
  if (!token) return Response.json({ message: 'Unauthorized' }, { status: 401 });

  const backendRes = await fetchBackend(req, path, token, forwardBody);
  // Corpo em stream (upload) já foi consumido no fetch acima: não há como repetir a requisição.
  if (backendRes.status !== 401 || forwardBody) return toResponse(backendRes);

  const refreshToken = await getServerRefreshToken();
  const refreshed = refreshToken ? await refreshSession(refreshToken) : null;
  if (!refreshed) return toResponse(backendRes);

  const retryRes = await fetchBackend(req, path, refreshed.accessToken, forwardBody);
  const response = toResponse(retryRes);
  for (const cookie of refreshed.setCookies) response.headers.append('set-cookie', cookie);
  return response;
}

/** Os cabeçalhos de segurança da mídia (`nosniff`, `sandbox`) precisam chegar ao navegador. */
const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-disposition',
  'content-range',
  'accept-ranges',
  'cache-control',
  'x-content-type-options',
  // Stream SSE: sem isto o nginx do cliente acumula o stream e o evento chega minutos depois.
  'x-accel-buffering',
  'content-security-policy',
];
