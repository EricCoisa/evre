import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const { mockAxiosInstance } = vi.hoisted(() => ({
  mockAxiosInstance: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}));

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: { ...actual.default, create: () => mockAxiosInstance },
  };
});

vi.mock('../actions/auth/server-auth', () => ({
  getServerAccessToken: vi.fn(),
  getServerLang: vi.fn(),
}));

vi.mock('./client-ip', () => ({
  clientIpHeader: vi.fn(),
}));

import { GET, POST } from './api';
import { getServerAccessToken, getServerLang } from '../actions/auth/server-auth';
import { clientIpHeader } from './client-ip';

// Captured once, right after `./api` is imported and runs `interceptors.request.use(...)`
// at module load — `vi.clearAllMocks()` in `beforeEach` wipes `.mock.calls` on every test,
// so this reference (not a fresh `.mock.calls[0]` lookup) is what each test must reuse.
const interceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0] as (
  config: { headers?: Record<string, string> },
) => Promise<{ headers: Record<string, string> }>;

describe('request interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientIpHeader).mockResolvedValue({});
  });

  it('attaches the bearer token when one is available', async () => {
    vi.mocked(getServerAccessToken).mockResolvedValue('tok123');
    vi.mocked(getServerLang).mockResolvedValue('en-US');

    const config = await interceptor({});

    expect(config.headers.Authorization).toBe('Bearer tok123');
    expect(config.headers['Accept-Language']).toBe('en-US');
  });

  it('omits the Authorization header when there is no token', async () => {
    vi.mocked(getServerAccessToken).mockResolvedValue(undefined);
    vi.mocked(getServerLang).mockResolvedValue('en-US');

    const config = await interceptor({});

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('falls back to pt-BR when there is no detected language', async () => {
    vi.mocked(getServerAccessToken).mockResolvedValue(undefined);
    vi.mocked(getServerLang).mockResolvedValue(undefined);

    const config = await interceptor({});

    expect(config.headers['Accept-Language']).toBe('pt-BR');
  });

  it('merges in the client IP header', async () => {
    vi.mocked(getServerAccessToken).mockResolvedValue(undefined);
    vi.mocked(getServerLang).mockResolvedValue('pt-BR');
    vi.mocked(clientIpHeader).mockResolvedValue({ 'x-forwarded-for': '1.2.3.4' });

    const config = await interceptor({});

    expect(config.headers['x-forwarded-for']).toBe('1.2.3.4');
  });
});

describe('GET/POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns a success envelope with the response data and status', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: { id: 1 }, status: 200 });

    await expect(GET('/things')).resolves.toEqual({ success: true, data: { id: 1 }, message: '', status: 200 });
  });

  it('POST returns a success envelope with the response data and status', async () => {
    mockAxiosInstance.post.mockResolvedValue({ data: { id: 2 }, status: 201 });

    await expect(POST('/things', { name: 'x' })).resolves.toEqual({ success: true, data: { id: 2 }, message: '', status: 201 });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/things', { name: 'x' }, undefined);
  });

  it('maps an AxiosError with a response into a failure envelope using the backend envelope', async () => {
    const error = new AxiosError('Request failed', undefined, undefined, undefined, {
      status: 404,
      data: { statusCode: 404, message: 'não encontrado' },
    } as never);
    mockAxiosInstance.get.mockRejectedValue(error);

    await expect(GET('/missing')).resolves.toEqual({ success: false, data: null, message: 'não encontrado', status: 404 });
  });

  it('falls back to a generic message when the error response has no envelope', async () => {
    const error = new AxiosError('Request failed', undefined, undefined, undefined, {
      status: 500,
      data: undefined,
    } as never);
    mockAxiosInstance.get.mockRejectedValue(error);

    await expect(GET('/boom')).resolves.toEqual({ success: false, data: null, message: 'Erro desconhecido', status: 500 });
  });

  it('maps a request-only AxiosError (no response) to a connection-error envelope', async () => {
    // handleError() sets statusCode:0 for a connection error, but the caller does
    // `err.statusCode || 500` — 0 is falsy, so it silently becomes 500, not 0.
    // Harmless today (nothing in this codebase branches on status === 0 from here),
    // but asserting the real behavior rather than the apparently-intended one.
    const error = new AxiosError('timeout', undefined, undefined, { aborted: false });
    mockAxiosInstance.post.mockRejectedValue(error);

    await expect(POST('/things')).resolves.toEqual({ success: false, data: null, message: 'Erro de conexão com o servidor', status: 500 });
  });

  it('maps a plain Error (not from axios) to a 500 envelope with its message', async () => {
    mockAxiosInstance.get.mockRejectedValue(new Error('algo quebrou'));

    await expect(GET('/x')).resolves.toEqual({ success: false, data: null, message: 'algo quebrou', status: 500 });
  });

  it('maps a totally unstructured throw to a generic 500 envelope', async () => {
    mockAxiosInstance.get.mockRejectedValue('string de erro');

    await expect(GET('/x')).resolves.toEqual({ success: false, data: null, message: 'Erro desconhecido', status: 500 });
  });
});
