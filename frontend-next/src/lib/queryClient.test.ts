import { describe, it, expect, vi, afterEach } from 'vitest';

describe('getQueryClient', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@tanstack/react-query');
  });

  it('reuses the same instance across calls in the browser', async () => {
    const { getQueryClient } = await import('./queryClient');

    const a = getQueryClient();
    const b = getQueryClient();

    expect(a).toBe(b);
  });

  it('builds a fresh instance per call on the server', async () => {
    vi.doMock('@tanstack/react-query', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@tanstack/react-query')>();
      return { ...actual, isServer: true };
    });
    vi.resetModules();
    const { getQueryClient } = await import('./queryClient');

    const a = getQueryClient();
    const b = getQueryClient();

    expect(a).not.toBe(b);
  });

  it('never retries once the error message mentions a 401', async () => {
    const { getQueryClient } = await import('./queryClient');
    const retry = getQueryClient().getDefaultOptions().queries?.retry as (
      count: number,
      error: unknown,
    ) => boolean;

    expect(retry(0, new Error('401 Unauthorized'))).toBe(false);
  });

  it('retries non-auth errors up to the configured count', async () => {
    const { getQueryClient } = await import('./queryClient');
    const retry = getQueryClient().getDefaultOptions().queries?.retry as (
      count: number,
      error: unknown,
    ) => boolean;

    expect(retry(0, new Error('network down'))).toBe(true);
    expect(retry(1, new Error('network down'))).toBe(true);
    expect(retry(2, new Error('network down'))).toBe(false);
  });
});
