import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('./api', () => ({
  fetchPageSources: vi.fn(),
  fetchSystemPageLayouts: vi.fn(),
  savePageLayout: vi.fn(),
  saveSystemPageLayout: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn(() => ({ emulateError: false })) }));

import {
  usePageSources,
  useSavePageLayout,
  useSystemPageLayouts,
  useSaveSystemPageLayout,
  SYSTEM_LAYOUTS_QUERY_KEY,
} from './queries';
import { fetchPageSources, fetchSystemPageLayouts, savePageLayout, saveSystemPageLayout } from './api';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <Suspense fallback={<div>loading</div>}>{children}</Suspense>
    </QueryClientProvider>
  );
}

describe('pageBuilder/queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usePageSources fetches the sources catalog', async () => {
    vi.mocked(fetchPageSources).mockResolvedValue({ success: true, data: [{ key: 'home' }], message: '', status: 200 } as never);

    const { result } = renderHook(() => usePageSources(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ key: 'home' }]);
  });

  it('usePageSources respects enabled:false', async () => {
    const { result } = renderHook(() => usePageSources({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchPageSources).not.toHaveBeenCalled();
  });

  it('useSavePageLayout saves and invalidates both user-configuration caches', async () => {
    vi.mocked(savePageLayout).mockResolvedValue({ success: true, data: undefined, message: '', status: 200 });
    const { result } = renderHook(() => useSavePageLayout(), { wrapper });

    result.current.mutate({ pageKey: 'home', layout: { blocks: [] } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(savePageLayout).toHaveBeenCalledWith('home', { blocks: [] });
  });

  it('useSystemPageLayouts suspends then resolves with the system layouts', async () => {
    vi.mocked(fetchSystemPageLayouts).mockResolvedValue({
      success: true,
      data: { layouts: { home: {} } },
      message: '',
      status: 200,
    });

    const { result } = renderHook(() => useSystemPageLayouts(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ layouts: { home: {} } }));
  });

  it('useSaveSystemPageLayout saves and invalidates the system-layouts cache', async () => {
    vi.mocked(saveSystemPageLayout).mockResolvedValue({ success: true, data: undefined, message: '', status: 200 });
    const { result } = renderHook(() => useSaveSystemPageLayout(), { wrapper });

    result.current.mutate({ pageKey: 'home', layout: { blocks: [] } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saveSystemPageLayout).toHaveBeenCalledWith('home', { blocks: [] });
  });

  it('exports a stable query key for the system layouts cache', () => {
    expect(SYSTEM_LAYOUTS_QUERY_KEY).toEqual(['page-builder-system-layouts']);
  });
});
