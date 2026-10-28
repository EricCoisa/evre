import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetPayload = vi.hoisted(() => vi.fn());
vi.mock('payload', () => ({ getPayload: mockGetPayload }));
vi.mock('@payload-config', () => ({ default: {} }));

import { getHomeData, getHomeDataClient } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getHomeData', () => {
  it('busca o primeiro doc da coleção home no Payload', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 'h1', title: 'Home' }] });
    mockGetPayload.mockResolvedValue({ find });

    const result = await getHomeData();

    expect(find).toHaveBeenCalledWith({ collection: 'home', limit: 1 });
    expect(result).toEqual({ id: 'h1', title: 'Home' });
  });

  it('retorna null quando não há docs', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] });
    mockGetPayload.mockResolvedValue({ find });

    await expect(getHomeData()).resolves.toBeNull();
  });

  it('retorna null quando o Payload lança erro', async () => {
    mockGetPayload.mockRejectedValue(new Error('conexão falhou'));

    await expect(getHomeData()).resolves.toBeNull();
  });
});

describe('getHomeDataClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('busca os dados da Home via fetch no client', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ docs: [{ id: 'h1', title: 'Home' }] }),
    } as unknown as Response);

    const result = await getHomeDataClient();

    expect(fetch).toHaveBeenCalledWith('/api/home', expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual({ id: 'h1', title: 'Home' });
  });

  it('retorna null quando a resposta não é ok', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, statusText: 'Internal Error' } as unknown as Response);

    await expect(getHomeDataClient()).resolves.toBeNull();
  });

  it('retorna null quando o fetch lança erro', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    await expect(getHomeDataClient()).resolves.toBeNull();
  });
});
