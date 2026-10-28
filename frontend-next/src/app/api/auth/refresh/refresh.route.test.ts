import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/actions/auth/server-auth', () => ({
  getServerRefreshToken: vi.fn(),
}));
vi.mock('@/lib/api/client-ip', () => ({
  clientIpHeader: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/api/session-refresh', () => ({
  refreshSession: vi.fn(),
}));

import { getServerRefreshToken } from '@/lib/actions/auth/server-auth';
import { refreshSession } from '@/lib/api/session-refresh';
import { POST } from './route';

const mockedGetRefreshToken = vi.mocked(getServerRefreshToken);
const mockedRefreshSession = vi.mocked(refreshSession);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/refresh', () => {
  it('sem refresh_token → 401, sem chamar o backend', async () => {
    mockedGetRefreshToken.mockResolvedValue(undefined);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('Refresh token not found');
    expect(mockedRefreshSession).not.toHaveBeenCalled();
  });

  it('refresh_token válido → 200, repassa os cookies renovados', async () => {
    mockedGetRefreshToken.mockResolvedValue('mytoken123');
    mockedRefreshSession.mockResolvedValue({
      accessToken: 'newtoken',
      setCookies: ['access_token=newtoken; HttpOnly', 'refresh_token=newrefresh; HttpOnly'],
    });

    const res = await POST();

    expect(res.status).toBe(200);
    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies.some((c: string) => c.includes('access_token=newtoken'))).toBe(true);
    expect(setCookies.some((c: string) => c.includes('refresh_token=newrefresh'))).toBe(true);
  });

  it('renovação falha no backend → 401', async () => {
    mockedGetRefreshToken.mockResolvedValue('badtoken');
    mockedRefreshSession.mockResolvedValue(null);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('Token refresh failed');
  });
});
