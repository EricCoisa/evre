import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/actions/auth/server-auth', () => ({
  getServerAccessToken: vi.fn(),
  getServerRefreshToken: vi.fn(),
  getServerLang: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/api/session-refresh', () => ({
  refreshSession: vi.fn(),
}));

import {
  getServerAccessToken,
  getServerRefreshToken,
} from '@/lib/actions/auth/server-auth';
import { refreshSession } from '@/lib/api/session-refresh';
import { proxyWithSession } from './session-proxy';

const mockedAccessToken = vi.mocked(getServerAccessToken);
const mockedRefreshToken = vi.mocked(getServerRefreshToken);
const mockedRefreshSession = vi.mocked(refreshSession);

function backendResponse(status: number, headers: Record<string, string> = {}) {
  return new Response('body', { status, headers });
}

function makeRequest(init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest('http://localhost/api/messaging/events', init);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('proxyWithSession', () => {
  it('sem access_token → 401 direto, sem chamar o backend', async () => {
    mockedAccessToken.mockResolvedValue(undefined);

    const res = await proxyWithSession(makeRequest(), '/messaging/events');

    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('backend responde ok → repassa status e corpo, sem tentar renovar', async () => {
    mockedAccessToken.mockResolvedValue('valid-token');
    mockFetch.mockResolvedValue(backendResponse(200, { 'content-type': 'application/json' }));

    const res = await proxyWithSession(makeRequest(), '/messaging/events');

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockedRefreshSession).not.toHaveBeenCalled();
  });

  it('401 do backend → renova pelo caminho single-flight e repete uma vez, propagando o set-cookie', async () => {
    mockedAccessToken.mockResolvedValue('stale-token');
    mockedRefreshToken.mockResolvedValue('my-refresh-token');
    mockFetch
      .mockResolvedValueOnce(backendResponse(401))
      .mockResolvedValueOnce(backendResponse(200, { 'content-type': 'application/json' }));
    mockedRefreshSession.mockResolvedValue({
      accessToken: 'fresh-token',
      setCookies: ['access_token=fresh-token; HttpOnly'],
    });

    const res = await proxyWithSession(makeRequest(), '/messaging/events');

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // a segunda tentativa usa o token novo
    const [, secondInit] = mockFetch.mock.calls[1];
    expect(secondInit.headers.get('Authorization')).toBe('Bearer fresh-token');
    expect(res.headers.get('set-cookie')).toContain('access_token=fresh-token');
  });

  it('renovação falha → 401 limpo, sem laço de retentativa', async () => {
    mockedAccessToken.mockResolvedValue('stale-token');
    mockedRefreshToken.mockResolvedValue('my-refresh-token');
    mockFetch.mockResolvedValue(backendResponse(401));
    mockedRefreshSession.mockResolvedValue(null);

    const res = await proxyWithSession(makeRequest(), '/messaging/events');

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('sem refresh_token → não tenta renovar, devolve o 401 original', async () => {
    mockedAccessToken.mockResolvedValue('stale-token');
    mockedRefreshToken.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue(backendResponse(401));

    const res = await proxyWithSession(makeRequest(), '/messaging/events');

    expect(res.status).toBe(401);
    expect(mockedRefreshSession).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('requisição com corpo em stream (upload) não é repetida no 401', async () => {
    mockedAccessToken.mockResolvedValue('stale-token');
    mockedRefreshToken.mockResolvedValue('my-refresh-token');
    mockFetch.mockResolvedValue(backendResponse(401));
    mockedRefreshSession.mockResolvedValue({
      accessToken: 'fresh-token',
      setCookies: ['access_token=fresh-token; HttpOnly'],
    });

    const req = makeRequest({ method: 'POST', body: 'file-bytes' });
    const res = await proxyWithSession(req, '/messaging/messages', { forwardBody: true });

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockedRefreshSession).not.toHaveBeenCalled();
  });

  it('backend inalcançável → 502, sem tentar renovar', async () => {
    mockedAccessToken.mockResolvedValue('valid-token');
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await proxyWithSession(makeRequest(), '/messaging/events');

    expect(res.status).toBe(502);
    expect(mockedRefreshSession).not.toHaveBeenCalled();
  });
});
