import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getPosts } from './api';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getPosts', () => {
  it('busca os posts publicados do Payload, mais recentes primeiro', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ docs: [{ id: 1, title: 'Post 1' }] }),
    } as unknown as Response);

    const result = await getPosts();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/posts?where[published][equals]=true&sort=-createdAt'),
    );
    expect(result).toEqual([{ id: 1, title: 'Post 1' }]);
  });

  it('lança erro quando a resposta não é ok', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as unknown as Response);

    await expect(getPosts()).rejects.toThrow('Failed to fetch posts');
  });
});
