import { describe, it, expect, vi, beforeEach } from 'vitest';

// O route handler lê o IP do cliente via `next/headers`, não do objeto Request —
// fora de um request scope do Next isso não existe, então mockamos o escopo.
const incomingHeaders = vi.hoisted(() => ({ value: new Headers() }));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(incomingHeaders.value),
}));

vi.mock('@/lib/actions/auth/server-auth', () => ({
  getServerLang: vi.fn().mockResolvedValue(undefined),
}));

// Must be hoisted before the route import
vi.mock('axios', () => {
  const post = vi.fn();
  // isAxiosError precisa existir também no default: as rotas chamam axios.isAxiosError(...)
  const isAxiosError = vi.fn();
  return {
    default: { post, isAxiosError, create: vi.fn(() => ({ post })) },
    isAxiosError,
  };
});

import axios, { isAxiosError } from 'axios';
import { getServerLang } from '@/lib/actions/auth/server-auth';
import { POST } from './route';
import { CAPTCHA_TOKEN_HEADER } from '@/lib/api/captcha-header';

const mockedPost = vi.mocked(axios.post);
const mockedIsAxiosError = vi.mocked(isAxiosError);
const mockedGetServerLang = vi.mocked(getServerLang);

beforeEach(() => {
  vi.clearAllMocks();
  incomingHeaders.value = new Headers();
  mockedGetServerLang.mockResolvedValue(undefined);
});

/** Headers que a rota montou para o backend. */
const sentHeaders = () =>
  (mockedPost.mock.calls[0]?.[2]?.headers ?? {}) as Record<string, string>;

function loginRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ email: 'a@b.com', password: 'secret' }),
  });
}

describe('POST /api/auth/login', () => {
  it('happy path: returns { user } and forwards set-cookie headers', async () => {
    const user = { id: '1', email: 'a@b.com' };
    mockedPost.mockResolvedValue({
      data: { user },
      headers: { 'set-cookie': ['access_token=abc; HttpOnly', 'refresh_token=xyz; HttpOnly'] },
    });

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'secret' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user).toEqual(user);
    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies.some((c: string) => c.includes('access_token=abc'))).toBe(true);
  });

  it('error path: backend returns string message → 401', async () => {
    const err = Object.assign(new Error(), {
      response: { data: { message: 'bad credentials' } },
    });
    mockedPost.mockRejectedValue(err);
    mockedIsAxiosError.mockReturnValue(true);

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('bad credentials');
  });

  it('error path: envelope do backend sem message → vazio, form traduz', async () => {
    const err = Object.assign(new Error(), {
      response: { data: { statusCode: 401 } },
    });
    mockedPost.mockRejectedValue(err);
    mockedIsAxiosError.mockReturnValue(true);

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    // Vazio de propósito: o formulário aplica o texto traduzido dele.
    expect(body.message).toBe('');
  });

  it('error path: network error (non-axios) → 401 sem vazar texto do axios', async () => {
    mockedPost.mockRejectedValue(new Error('Network Error'));
    mockedIsAxiosError.mockReturnValue(false);

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'secret' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    // Falha de rede não vaza o texto do axios para a tela.
    expect(body.message).toBe('');
  });

  it('repassa o token do captcha ao backend', async () => {
    mockedPost.mockResolvedValue({ data: { user: {} }, headers: {} });

    await POST(loginRequest({ [CAPTCHA_TOKEN_HEADER]: 'tok-1' }));

    expect(sentHeaders()[CAPTCHA_TOKEN_HEADER]).toBe('tok-1');
  });

  it('sem captcha configurado não inventa header', async () => {
    mockedPost.mockResolvedValue({ data: { user: {} }, headers: {} });

    await POST(loginRequest());

    expect(sentHeaders()).not.toHaveProperty(CAPTCHA_TOKEN_HEADER);
  });

  it('captcha e IP do cliente viajam juntos', async () => {
    mockedPost.mockResolvedValue({ data: { user: {} }, headers: {} });
    incomingHeaders.value = new Headers({ 'x-forwarded-for': '203.0.113.7' });

    await POST(loginRequest({ [CAPTCHA_TOKEN_HEADER]: 'tok-1' }));

    // Os dois saem do mesmo objeto de headers: um não pode sobrescrever o outro.
    expect(sentHeaders()).toMatchObject({
      [CAPTCHA_TOKEN_HEADER]: 'tok-1',
      'x-forwarded-for': '203.0.113.7',
    });
  });

  it('o corpo continua só com as credenciais', async () => {
    mockedPost.mockResolvedValue({ data: { user: {} }, headers: {} });

    await POST(loginRequest({ [CAPTCHA_TOKEN_HEADER]: 'tok-1' }));

    // Captcha em header, não em body: nenhum DTO do backend conhece captcha.
    expect(mockedPost.mock.calls[0][1]).toEqual({
      email: 'a@b.com',
      password: 'secret',
    });
  });

  it('propaga o idioma da sessão ao backend via Accept-Language', async () => {
    mockedPost.mockResolvedValue({ data: { user: {} }, headers: {} });
    mockedGetServerLang.mockResolvedValue('en');

    await POST(loginRequest());

    expect(sentHeaders()['Accept-Language']).toBe('en');
  });

  it('sem idioma salvo, cai no fallback pt-BR (mesma semântica do mutator do Orval)', async () => {
    mockedPost.mockResolvedValue({ data: { user: {} }, headers: {} });
    mockedGetServerLang.mockResolvedValue(undefined);

    await POST(loginRequest());

    expect(sentHeaders()['Accept-Language']).toBe('pt-BR');
  });
});
