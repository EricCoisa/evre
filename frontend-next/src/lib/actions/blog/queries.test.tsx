import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getPosts: vi.fn(),
}));

import { getPosts } from './api';
import { usePosts } from './queries';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePosts', () => {
  it('busca a lista de posts', async () => {
    vi.mocked(getPosts).mockResolvedValue([{ id: 1, title: 'Post 1' } as never]);

    const { result } = renderHook(() => usePosts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPosts).toHaveBeenCalled();
    expect(result.current.data).toEqual([{ id: 1, title: 'Post 1' }]);
  });
});
