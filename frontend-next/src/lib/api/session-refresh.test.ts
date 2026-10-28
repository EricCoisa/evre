import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { refreshSession, readSetCookie } from './session-refresh';

function okResponse(accessToken = 'fresh-access') {
  return {
    ok: true,
    headers: {
      getSetCookie: () => [
        `access_token=${accessToken}; HttpOnly`,
        'refresh_token=fresh-refresh; HttpOnly',
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('readSetCookie', () => {
  it('extrai o valor do cookie pelo nome', () => {
    const value = readSetCookie(['access_token=abc; HttpOnly; Path=/'], 'access_token');
    expect(value).toBe('abc');
  });

  it('nome ausente → undefined', () => {
    expect(readSetCookie(['refresh_token=x'], 'access_token')).toBeUndefined();
  });
});

describe('refreshSession', () => {
  it('sucesso: devolve o access_token novo e os set-cookie', async () => {
    mockFetch.mockResolvedValue(okResponse());

    const result = await refreshSession('my-refresh-token');

    expect(result?.accessToken).toBe('fresh-access');
    expect(result?.setCookies).toHaveLength(2);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Cookie).toBe('refresh_token=my-refresh-token');
  });

  it('backend nega (not ok) → null', async () => {
    mockFetch.mockResolvedValue({ ok: false, headers: { getSetCookie: () => [] } });
    expect(await refreshSession('dead-token')).toBeNull();
  });

  it('backend fora do ar → null, sem lançar', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    expect(await refreshSession('any-token')).toBeNull();
  });

  it('chamadas concorrentes com o MESMO token compartilham uma única renovação', async () => {
    let resolveFetch!: (v: unknown) => void;
    mockFetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    const first = refreshSession('shared-token');
    const second = refreshSession('shared-token');
    resolveFetch(okResponse());

    await Promise.all([first, second]);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('tokens DIFERENTES renovam em paralelo, cada um com sua chamada', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await Promise.all([refreshSession('token-a'), refreshSession('token-b')]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('depois de concluída, a próxima chamada com o mesmo token dispara nova renovação', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await refreshSession('reused-token');
    await refreshSession('reused-token');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
