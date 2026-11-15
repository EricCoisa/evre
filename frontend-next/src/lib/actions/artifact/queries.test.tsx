import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getArtifacts: vi.fn(),
  archiveArtifact: vi.fn(),
  deleteArtifactPermanently: vi.fn(),
  getArtifactPreviewUrl: vi.fn(),
  publishArtifact: vi.fn(),
  updateArtifact: vi.fn(),
  uploadArtifact: vi.fn(),
}));
vi.mock('@/lib/api/collector', () => ({
  Collector: (fn: () => unknown) => fn,
  Alive: (fn: () => unknown) => async () => {
    const result = await (fn as () => Promise<unknown>)();
    return (result as { data: unknown })?.data ?? result;
  },
}));
vi.mock('@/contexts/appProvider', () => ({
  useApp: () => ({ emulateError: false }),
}));

import { getArtifacts, archiveArtifact, getArtifactPreviewUrl } from './api';
import { useArtifacts, useArchiveArtifact, useArtifactPreviewUrl } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useArtifacts', () => {
  it('lista artefatos', async () => {
    vi.mocked(getArtifacts).mockResolvedValue(ok([{ id: 'a1' }]) as never);

    const { result } = renderHook(() => useArtifacts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getArtifacts).toHaveBeenCalledWith(undefined);
  });
});

describe('useArtifactPreviewUrl', () => {
  it('busca URL de preview quando id existe', async () => {
    vi.mocked(getArtifactPreviewUrl).mockResolvedValue(
      ok({ url: 'https://s3/preview' }) as never,
    );

    const { result } = renderHook(() => useArtifactPreviewUrl('a1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getArtifactPreviewUrl).toHaveBeenCalledWith('a1');
  });

  it('não busca quando id é nulo (enabled: false)', () => {
    const { result } = renderHook(() => useArtifactPreviewUrl(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getArtifactPreviewUrl).not.toHaveBeenCalled();
  });
});

describe('useArchiveArtifact', () => {
  it('arquiva artefato e invalida query de artefatos', async () => {
    vi.mocked(archiveArtifact).mockResolvedValue(ok({ id: 'a1' }) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useArchiveArtifact(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    result.current.mutate('a1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['artifacts'] });
  });
});
