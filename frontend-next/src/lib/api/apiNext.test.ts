import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APINEXT, ApiNextError } from './apiNext';

function jsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: () => 'application/json' },
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function noBodyResponse(init: { status?: number; ok?: boolean } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 204,
    headers: { get: () => null },
    json: vi.fn(),
  } as unknown as Response;
}

describe('APINEXT', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET parses a JSON response and hits the relative /api path from the browser', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ hello: 'world' }));

    const result = await APINEXT.GET<{ hello: string }>('/ping');

    expect(result).toEqual({ hello: 'world' });
    expect(fetch).toHaveBeenCalledWith('/api/ping', expect.objectContaining({ method: 'GET', credentials: 'include' }));
  });

  it('GET returns null for a body-less response (e.g. 204)', async () => {
    vi.mocked(fetch).mockResolvedValue(noBodyResponse());

    await expect(APINEXT.GET('/ping')).resolves.toBeNull();
  });

  it('POST serializes the body as JSON, merging a custom header on top of the default Content-Type', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 1 }));

    await APINEXT.POST('/things', { name: 'x' }, { headers: { Authorization: 'Bearer t' } });

    expect(fetch).toHaveBeenCalledWith(
      '/api/things',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'x' }),
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      }),
    );
  });

  it('POST omits the body when no data is given', async () => {
    vi.mocked(fetch).mockResolvedValue(noBodyResponse());

    await APINEXT.POST('/ping');

    expect(fetch).toHaveBeenCalledWith('/api/ping', expect.objectContaining({ body: undefined }));
  });

  it('PATCH and PUT serialize their body the same way POST does', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await APINEXT.PATCH('/things/1', { name: 'y' });
    await APINEXT.PUT('/things/1', { name: 'z' });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/things/1', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'y' }) }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/things/1', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'z' }) }));
  });

  it('DELETE sends no body', async () => {
    vi.mocked(fetch).mockResolvedValue(noBodyResponse());

    await APINEXT.DELETE('/things/1');

    expect(fetch).toHaveBeenCalledWith('/api/things/1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('throws an ApiNextError built from the JSON error envelope on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'não encontrado', extra: 1 }, { ok: false, status: 404 }));

    await expect(APINEXT.GET('/missing')).rejects.toMatchObject({
      statusCode: 404,
      message: 'não encontrado',
      details: { message: 'não encontrado', extra: 1 },
    });
    await expect(APINEXT.GET('/missing')).rejects.toBeInstanceOf(ApiNextError);
  });

  it('falls back to a generic message when the error response has no JSON body', async () => {
    vi.mocked(fetch).mockResolvedValue(noBodyResponse({ ok: false, status: 500 }));

    await expect(APINEXT.GET('/boom')).rejects.toMatchObject({ statusCode: 500, message: 'GET request failed' });
  });

  it('combines a caller-provided AbortSignal with the internal timeout without throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
    const controller = new AbortController();

    await expect(APINEXT.GET('/ping', { signal: controller.signal })).resolves.toEqual({});
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('targets an absolute URL when there is no window (server-side)', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
    const originalWindow = globalThis.window;
    // @ts-expect-error simula execução no servidor, onde `window` não existe
    delete globalThis.window;

    try {
      await APINEXT.GET('/ping');
    } finally {
      globalThis.window = originalWindow;
    }

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/ping', expect.anything());
  });
});
