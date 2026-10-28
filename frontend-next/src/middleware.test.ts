import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// middleware uses global fetch; mock it
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { middleware } from './middleware';

function makeRequest(
  pathname: string,
  cookies: Record<string, string> = {},
  headers?: Record<string, string>,
) {
  const url = `http://localhost${pathname}`;
  const req = new NextRequest(url, headers ? { headers } : undefined);
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

/** Resposta do POST /auth/refresh do backend, com os Set-Cookie renovados. */
function refreshOk(accessToken = 'fresh-access', refreshToken = 'fresh-refresh') {
  return {
    ok: true,
    status: 200,
    headers: {
      getSetCookie: () => [
        `access_token=${accessToken}; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Lax`,
        `refresh_token=${refreshToken}; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax`,
      ],
    },
  };
}

const refreshFailed = { ok: false, status: 401, headers: { getSetCookie: () => [] } };

/** `GET /user-route-access/me` responde sempre 200 — a permissão vem no corpo. */
const accessOk = {
  ok: true,
  status: 200,
  json: async () => true,
  headers: { getSetCookie: () => [] },
};
const accessDenied = { ...accessOk, json: async () => false };
const accessUnauthorized = {
  ok: false,
  status: 401,
  json: async () => null,
  headers: { getSetCookie: () => [] },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('middleware', () => {
  it('public path → passes through and sets x-pathname header', async () => {
    const req = makeRequest('/login');
    const res = await middleware(req);

    // Not a redirect
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(302);
    // header is on the forwarded request, not the response itself — Next.js exposes it
    // via this x-middleware-request-* mirror
    expect(res.headers.get('x-middleware-request-x-pathname')).toBe('/login');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('private path, no cookies → redirects to /login with callbackUrl', async () => {
    const req = makeRequest('/dashboard');
    const res = await middleware(req);

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('/login');
    expect(res.headers.get('location')).toContain('callbackUrl');
  });

  it('private path with access_token, backend returns 200 → passes through', async () => {
    mockFetch.mockResolvedValue(accessOk);

    const req = makeRequest('/dashboard', { access_token: 'valid-token' });
    const res = await middleware(req);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(res.status).not.toBeGreaterThanOrEqual(300);
  });

  it('repassa x-forwarded-for ao backend — sem ele o throttler vira balde único', async () => {
    mockFetch.mockResolvedValue(accessOk);

    const req = makeRequest(
      '/dashboard',
      { access_token: 'valid-token' },
      { 'x-forwarded-for': '203.0.113.7' },
    );
    await middleware(req);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['x-forwarded-for']).toBe('203.0.113.7');
  });

  it('sem proxy na frente (dev) → não inventa x-forwarded-for', async () => {
    mockFetch.mockResolvedValue(accessOk);

    const req = makeRequest('/dashboard', { access_token: 'valid-token' });
    await middleware(req);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).not.toHaveProperty('x-forwarded-for');
  });

  it('negação real de permissão (200 + false) → /access-denied, nunca /redirect', async () => {
    mockFetch.mockResolvedValue(accessDenied);

    const req = makeRequest('/dashboard', { access_token: 'forbidden-token' });
    const res = await middleware(req);

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    // /redirect é rota privada: mandar o negado para lá reentrava no middleware e
    // redirecionava para si mesmo — ERR_TOO_MANY_REDIRECTS.
    expect(res.headers.get('location')).toContain('/access-denied');
    expect(res.headers.get('location')).not.toContain('/redirect');
  });

  it('private path with access_token, backend throws → fails open (passes through)', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const req = makeRequest('/dashboard', { access_token: 'any-token' });
    const res = await middleware(req);

    // fail-open: not a redirect
    expect(res.status).not.toBeGreaterThanOrEqual(300);
  });

  /** 429 (ou outra falha de infra) do throttler não deve negar acesso a quem tem permissão. */
  it.each([429, 500, 502, 503, 404])(
    '%s do backend não nega acesso — falha de infra não tranca quem tem permissão',
    async (status) => {
      mockFetch.mockResolvedValue({
        ok: false,
        status,
        json: async () => null,
        headers: { getSetCookie: () => [] },
      });

      const req = makeRequest('/dashboard', { access_token: 'valid-token' });
      const res = await middleware(req);

      expect(res.status).not.toBeGreaterThanOrEqual(300);
    },
  );

  /** Polling por server action passa pelo matcher e não deve esgotar o throttler. */
  it.each([
    ['server action', { 'next-action': 'abc123' }],
    ['prefetch do router', { 'next-router-prefetch': '1' }],
  ])('%s não consulta o acesso à rota — a página já foi checada', async (_, headers) => {
    mockFetch.mockResolvedValue(accessOk);

    const req = makeRequest('/settings', { access_token: 'valid' }, headers);
    const res = await middleware(req);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(res.status).not.toBeGreaterThanOrEqual(300);
  });

  it('navegação de verdade continua checando', async () => {
    mockFetch.mockResolvedValue(accessOk);

    await middleware(makeRequest('/settings', { access_token: 'valid' }));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/user-route-access/me'),
      expect.any(Object),
    );
  });

  it('403 continua negando — é a recusa explícita do backend', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => null,
      headers: { getSetCookie: () => [] },
    });

    const req = makeRequest('/dashboard', { access_token: 'valid-token' });
    const res = await middleware(req);

    expect(res.headers.get('location')).toContain('/access-denied');
  });

  it('só refresh_token → renova no middleware e segue, sem passar pelo /login', async () => {
    mockFetch
      .mockResolvedValueOnce(refreshOk()) // POST /auth/refresh
      .mockResolvedValueOnce(accessOk); // checkAccess com o token novo

    const req = makeRequest('/dashboard', { refresh_token: 'refresh-only' });
    const res = await middleware(req);

    expect(res.status).not.toBeGreaterThanOrEqual(300);
    // o browser recebe os cookies renovados
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('access_token=fresh-access');
    // e o RSC desta mesma request enxerga o token novo
    expect(res.headers.get('x-middleware-request-cookie')).toContain('fresh-access');
  });

  it('só refresh_token, mas o refresh falha → /login?expired=1 e cookies limpos', async () => {
    mockFetch.mockResolvedValue(refreshFailed);

    const req = makeRequest('/dashboard', { refresh_token: 'dead-refresh' });
    const res = await middleware(req);

    expect(res.status).toBeGreaterThanOrEqual(300);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/login');
    expect(location).toContain('expired=1');
    // cookies mortos são descartados, senão o middleware os revalidaria a cada navegação
    expect(res.headers.get('set-cookie') ?? '').toContain('access_token=;');
  });

  it('cookie vivo mas JWT expirado (401 no checkAccess) → renova e segue', async () => {
    mockFetch
      .mockResolvedValueOnce(accessUnauthorized) // checkAccess com token morto
      .mockResolvedValueOnce(refreshOk()) // renovação
      .mockResolvedValueOnce(accessOk); // checkAccess com token novo

    const req = makeRequest('/user', {
      access_token: 'stale-but-present',
      refresh_token: 'good-refresh',
    });
    const res = await middleware(req);

    expect(res.status).not.toBeGreaterThanOrEqual(300);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('401 no checkAccess e refresh também falha → /login?expired=1', async () => {
    mockFetch
      .mockResolvedValueOnce(accessUnauthorized)
      .mockResolvedValueOnce(refreshFailed);

    const req = makeRequest('/user', {
      access_token: 'stale',
      refresh_token: 'dead',
    });
    const res = await middleware(req);

    expect(res.headers.get('location')).toContain('expired=1');
  });

  it('corpo `false` bloqueia mesmo com 200 — o status sozinho nunca nega', async () => {
    mockFetch.mockResolvedValue(accessDenied);

    const req = makeRequest('/dashboard', { access_token: 'valid-token' });
    const res = await middleware(req);

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('/access-denied');
  });

  it('/redirect não passa pelo check — é despacho, e o destino é checado depois', async () => {
    const req = makeRequest('/redirect', { access_token: 'valid-token' });
    const res = await middleware(req);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(res.status).not.toBeGreaterThanOrEqual(300);
  });

  it('corpo ilegível não tranca ninguém (fail-open)', async () => {
    mockFetch.mockResolvedValue({
      ...accessOk,
      json: async () => {
        throw new Error('not json');
      },
    });

    const req = makeRequest('/dashboard', { access_token: 'valid-token' });
    const res = await middleware(req);

    expect(res.status).not.toBeGreaterThanOrEqual(300);
  });

  it('/admin com sec-fetch-dest: document → redireciona diretamente para /cms', async () => {
    const req = makeRequest('/admin', {}, { 'sec-fetch-dest': 'document' });
    const res = await middleware(req);

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toBe('http://localhost/cms');
  });

  it('/admin/collections/media com sec-fetch-dest: document → redireciona para /cms com path preservado', async () => {
    const req = makeRequest('/admin/collections/media', {}, { 'sec-fetch-dest': 'document' });
    const res = await middleware(req);

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const location = res.headers.get('location');
    expect(location).toContain('/cms?path=');
    expect(location).toContain(encodeURIComponent('/admin/collections/media'));
  });

  it('/admin carregado dentro de iframe (sec-fetch-dest: iframe) → não redireciona', async () => {
    const req = makeRequest('/admin', {}, { 'sec-fetch-dest': 'iframe' });
    const res = await middleware(req);

    expect(res.status).not.toBeGreaterThanOrEqual(300);
  });
});
