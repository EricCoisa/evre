import {
  PROVIDER_TIMEOUT_MS,
  PROVIDER_TRANSFER_TIMEOUT_MS,
  ProviderRequestError,
  ProviderTimeoutError,
  isTransientProviderError,
  providerFetch,
  requestJson,
  uploadTimeoutMs,
} from './provider-http.util';

describe('providerFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('toda chamada leva um AbortSignal (sem ele o Node espera ~5 minutos)', async () => {
    const spy = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', spy);
    await providerFetch('http://evolution:8080/x', { method: 'POST' });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('prazo estourado vira ProviderTimeoutError, distinto de uma recusa do provider', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
        ),
    );
    const failure = (await providerFetch('http://evolution:8080/x').catch(
      (e: unknown) => e,
    )) as ProviderTimeoutError;
    expect(failure).toBeInstanceOf(ProviderTimeoutError);
    expect(failure.message).toContain('evolution:8080');
    expect(failure.timeoutMs).toBe(PROVIDER_TIMEOUT_MS);
  });

  it('outras falhas de rede passam como estão', async () => {
    const down = new TypeError('fetch failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(down));
    await expect(providerFetch('http://x')).rejects.toBe(down);
  });

  // Prova de ponta a ponta: um servidor que nunca responde é cortado no prazo, sem mock de fetch.
  it('corta de verdade um servidor que não responde', async () => {
    const { createServer } = await import('http');
    const server = createServer(() => undefined); // aceita e nunca responde
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as { port: number };
    try {
      const started = Date.now();
      await expect(
        providerFetch(`http://127.0.0.1:${port}/`, {}, 150),
      ).rejects.toBeInstanceOf(ProviderTimeoutError);
      expect(Date.now() - started).toBeLessThan(2_000);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});

describe('requestJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resposta não-2xx lança ProviderRequestError com o status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'sessão caiu' }), {
          status: 500,
        }),
      ),
    );
    const failure = (await requestJson('Evolution API', 'http://x', {}).catch(
      (e: unknown) => e,
    )) as ProviderRequestError;
    expect(failure).toBeInstanceOf(ProviderRequestError);
    expect(failure.status).toBe(500);
    expect(failure.message).toBe('Evolution API 500: sessão caiu');
  });

  it('o prazo informado vale para a chamada', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('x'), { name: 'TimeoutError' }),
        ),
    );
    const failure = (await requestJson('Meta', 'http://x', {}, 120_000).catch(
      (e: unknown) => e,
    )) as ProviderTimeoutError;
    expect(failure).toBeInstanceOf(ProviderTimeoutError);
    expect(failure.timeoutMs).toBe(120_000);
  });
});

describe('uploadTimeoutMs', () => {
  it('anexo pequeno fica perto do prazo comum; o prazo cresce 1 s por MB', () => {
    expect(uploadTimeoutMs(1)).toBe(PROVIDER_TIMEOUT_MS + 1_000);
    expect(uploadTimeoutMs(10 * 1_000_000)).toBe(PROVIDER_TIMEOUT_MS + 10_000);
  });

  it('nunca passa do teto de transferência (o upload máximo é 64 MB)', () => {
    expect(uploadTimeoutMs(64 * 1024 * 1024)).toBeLessThanOrEqual(
      PROVIDER_TRANSFER_TIMEOUT_MS,
    );
    expect(uploadTimeoutMs(10 * 1024 * 1024 * 1024)).toBe(
      PROVIDER_TRANSFER_TIMEOUT_MS,
    );
  });
});

describe('isTransientProviderError', () => {
  it.each([500, 502, 503, 429, 408])('HTTP %i é transitório', (status) => {
    expect(
      isTransientProviderError(new ProviderRequestError('x', status, 'x')),
    ).toBe(true);
  });

  it.each([400, 401, 403, 404, 422])('HTTP %i não se repete', (status) => {
    expect(
      isTransientProviderError(new ProviderRequestError('x', status, 'x')),
    ).toBe(false);
  });

  it('conexão recusada ou derrubada (fetch failed) é transitória', () => {
    expect(isTransientProviderError(new TypeError('fetch failed'))).toBe(true);
  });

  // Sem resposta a tempo o provider pode ter enviado: repetir duplicaria.
  it('timeout, TypeError de outra causa e erro comum não se repetem', () => {
    expect(
      isTransientProviderError(new ProviderTimeoutError('http://x', 1)),
    ).toBe(false);
    expect(isTransientProviderError(new TypeError('x is not a function'))).toBe(
      false,
    );
    expect(isTransientProviderError(new Error('fetch failed'))).toBe(false);
    expect(isTransientProviderError('boom')).toBe(false);
  });
});
