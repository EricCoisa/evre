import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.unmock('@/lib/actions/auth/queries');
vi.mock('./api', () => ({
  getProfile: vi.fn(),
  getOAuthProviders: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn(() => ({ emulateError: false })) }));

import { useMe, useOAuthProviders } from './queries';
import { getProfile, getOAuthProviders } from './api';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <Suspense fallback={<div>loading</div>}>{children}</Suspense>
    </QueryClientProvider>
  );
}

describe('auth/queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useMe suspends then resolves with the profile', async () => {
    vi.mocked(getProfile).mockResolvedValue({
      success: true, data: { name: 'Alice' }, message: '', status: 200,
    } as never);

    const { result } = renderHook(() => useMe(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ name: 'Alice' }));
  });

  it('useOAuthProviders fetches the provider list', async () => {
    vi.mocked(getOAuthProviders).mockResolvedValue({
      success: true, data: [{ id: 'google', label: 'Google', configured: true, enabled: true }], message: '', status: 200,
    });

    const { result } = renderHook(() => useOAuthProviders(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'google', label: 'Google', configured: true, enabled: true }]);
  });
});
