import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/actions/auth/server-auth', () => ({
  getServerLang: vi.fn().mockResolvedValue(undefined),
}));

// Must be hoisted before the route import
vi.mock('axios', () => {
  const post = vi.fn();
  const isAxiosError = vi.fn(() => false);
  return {
    default: { post, isAxiosError, create: vi.fn(() => ({ post })) },
    isAxiosError,
  };
});

import axios from 'axios';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { OAUTH_STATE_COOKIE } from '@/lib/oauth-state-cookie';
import { OAUTH_SIGNUP_COOKIE } from '@/lib/oauth-signup-cookie';

const mockedPost = vi.mocked(axios.post);

/** `cookieState` ausente simula um browser que nunca iniciou o fluxo. */
const makeRequest = (query: string, cookieState?: string) => {
  const request = new NextRequest(`http://localhost/api/auth/oauth/callback${query}`);
  if (cookieState !== undefined) {
    request.cookies.set(OAUTH_STATE_COOKIE, cookieState);
  }
  return request;
};

const stateCookieOf = (res: Response) =>
  (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/auth/oauth/callback', () => {
  it('repassa os cookies do backend e redireciona ao callbackUrl', async () => {
    mockedPost.mockResolvedValue({
      data: { callbackUrl: '/settings?tab=emailConfig' },
      headers: {
        'set-cookie': ['access_token=abc; HttpOnly', 'refresh_token=xyz; HttpOnly'],
      },
    });

    const res = await GET(makeRequest('?code=c1&state=s1', 's1'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost/settings?tab=emailConfig'
    );
    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies.some((c: string) => c.includes('access_token=abc'))).toBe(true);
    expect(setCookies.some((c: string) => c.includes('refresh_token=xyz'))).toBe(true);
  });

  it('consome o state: expira o cookie mesmo no caminho feliz', async () => {
    mockedPost.mockResolvedValue({ data: {}, headers: {} });

    const res = await GET(makeRequest('?code=c1&state=s1', 's1'));

    expect(stateCookieOf(res)).toMatch(/Max-Age=0/);
  });

  it('redireciona para consentimento sem expor token OAuth na URL', async () => {
    mockedPost.mockResolvedValue({
      data: {
        consentRequired: true,
        signupIntent: 'SIGNUP',
        signupToken: 'intent.secret',
        providerId: 'google',
      },
      headers: {},
    });

    const res = await GET(makeRequest('?code=c1&state=s1', 's1'));

    expect(res.headers.get('location')).toBe(
      'http://localhost/signup?provider=google&signupIntent=SIGNUP',
    );
    expect(res.headers.get('location')).not.toContain('intent.secret');
    expect(
      (res.headers.getSetCookie?.() ?? []).some((cookie: string) =>
        cookie.startsWith(`${OAUTH_SIGNUP_COOKIE}=intent.secret`),
      ),
    ).toBe(true);
  });

  it('cai em /redirect quando o state não trazia destino', async () => {
    mockedPost.mockResolvedValue({ data: {}, headers: {} });

    const res = await GET(makeRequest('?code=c1&state=s1', 's1'));

    expect(res.headers.get('location')).toBe('http://localhost/redirect');
  });

  // ── login CSRF ────────────────────────────────────────────────
  // O atacante inicia o próprio fluxo, guarda um (code, state) legítimo e induz a
  // vítima a abrir esta rota. O browser da vítima não tem o cookie correspondente.

  it('recusa state válido sem cookie no browser (callback forjado)', async () => {
    const res = await GET(makeRequest('?code=c1&state=s1'));

    expect(res.headers.get('location')).toBe('http://localhost/login?error=oauth');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('recusa state que não bate com o cookie deste browser', async () => {
    const res = await GET(makeRequest('?code=c1&state=do-atacante', 's1'));

    expect(res.headers.get('location')).toBe('http://localhost/login?error=oauth');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('volta ao login com erro quando faltam code/state (sem chamar o backend)', async () => {
    const res = await GET(makeRequest('?code=c1', 's1'));

    expect(res.headers.get('location')).toBe('http://localhost/login?error=oauth');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('volta ao login com erro quando o backend recusa', async () => {
    mockedPost.mockRejectedValue(new Error('401'));

    const res = await GET(makeRequest('?code=c1&state=s1', 's1'));

    expect(res.headers.get('location')).toBe('http://localhost/login?error=oauth');
  });
});
