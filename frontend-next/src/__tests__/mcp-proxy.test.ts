import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

import { apiTarget, proxyToBackend, rootTarget } from '@/lib/api/mcp-proxy';

const fetchMock = vi.fn();

/** NextRequest mínimo: o proxy só usa method, headers, text(), signal e nextUrl. */
function request(
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  return {
    method: init.method ?? 'POST',
    headers: new Headers(init.headers ?? {}),
    text: async () => init.body ?? '',
    signal: undefined,
    nextUrl: new URL('http://front.local/mcp'),
  } as unknown as NextRequest;
}

function backendResponse(
  status: number,
  headers: Record<string, string> = {},
  body: string | null = '{}',
) {
  return new Response(status === 204 || status === 304 ? null : body, {
    status,
    headers,
  });
}

/** Testa os headers do proxy MCP que expõem o front ao cliente, nunca o backend. */
describe('mcp-proxy', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('monta o alvo sob /api/v1 e o alvo na raiz do backend', () => {
    // A raiz é necessária porque os RFCs ancoram /.well-known fora de qualquer prefixo.
    expect(apiTarget('/mcp')).toMatch(/\/api\/v1\/mcp$/);
    expect(rootTarget('/.well-known/x')).toMatch(/\/\.well-known\/x$/);
    expect(rootTarget('/.well-known/x')).not.toContain('/api/v1');
  });

  it('propaga o WWW-Authenticate do 401 — é o header que inicia o OAuth', async () => {
    fetchMock.mockResolvedValue(
      backendResponse(401, {
        'www-authenticate': 'Bearer resource_metadata="https://app/.well-known/x"',
        'content-type': 'application/json',
      }),
    );

    const res = await proxyToBackend(request(), 'http://backend/api/v1/mcp');

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('repassa Authorization e x-forwarded-for para o backend', async () => {
    fetchMock.mockResolvedValue(backendResponse(200));

    await proxyToBackend(
      request({
        headers: {
          authorization: 'Bearer mcpat_abc',
          'x-forwarded-for': '203.0.113.7',
          'content-type': 'application/json',
        },
      }),
      'http://backend/api/v1/mcp',
    );

    const sent = fetchMock.mock.calls[0][1].headers as Headers;
    expect(sent.get('authorization')).toBe('Bearer mcpat_abc');
    // Sem isto, todo registro dinâmico compartilha o balde de throttle do container.
    expect(sent.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('não vaza cookie de sessão nem host do front para o backend', async () => {
    fetchMock.mockResolvedValue(backendResponse(200));

    await proxyToBackend(
      request({ headers: { cookie: 'access_token=segredo', host: 'app.example.com' } }),
      'http://backend/api/v1/mcp',
    );

    const sent = fetchMock.mock.calls[0][1].headers as Headers;
    expect(sent.get('cookie')).toBeNull();
    expect(sent.get('host')).toBeNull();
  });

  it('não segue o 302 do /authorize: devolve o Location ao browser', async () => {
    fetchMock.mockResolvedValue(
      backendResponse(302, { location: 'https://app/profile/connect?req=jwt' }, null),
    );

    const res = await proxyToBackend(request({ method: 'GET' }), 'http://backend/api/v1/oauth/authorize');

    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://app/profile/connect?req=jwt');
  });

  it('preserva Cache-Control no-store da resposta de token (RFC 6749 §5.1)', async () => {
    fetchMock.mockResolvedValue(
      backendResponse(200, { 'cache-control': 'no-store', 'content-type': 'application/json' }),
    );

    const res = await proxyToBackend(request(), 'http://backend/api/v1/oauth/token');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('GET não manda corpo; POST manda', async () => {
    // Factory, não mockResolvedValue: um Response só pode ter o body lido uma vez,
    // e este teste faz duas chamadas.
    fetchMock.mockImplementation(async () => backendResponse(200));

    await proxyToBackend(request({ method: 'GET' }), 'http://backend/api/v1/mcp');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();

    await proxyToBackend(request({ method: 'POST', body: '{"a":1}' }), 'http://backend/api/v1/mcp');
    expect(fetchMock.mock.calls[1][1].body).toBe('{"a":1}');
  });

  it('204 do DELETE passa sem corpo — construir Response com body aqui estouraria', async () => {
    fetchMock.mockResolvedValue(backendResponse(204, {}, null));

    const res = await proxyToBackend(
      request({ method: 'DELETE' }),
      'http://backend/api/v1/mcp',
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('backend inalcançável vira 502 com erro OAuth, não 500', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await proxyToBackend(request(), 'http://backend/api/v1/mcp');

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'server_error' });
  });
});
