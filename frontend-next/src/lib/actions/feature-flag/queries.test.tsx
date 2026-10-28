import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('./api', () => ({
  getMyFeatureFlags: vi.fn(),
  getAllFeatureFlags: vi.fn(),
  createFeatureFlag: vi.fn(),
  updateFeatureFlag: vi.fn(),
  deleteFeatureFlag: vi.fn(),
  setFeatureFlagRoles: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import {
  getMyFeatureFlags,
  getAllFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  setFeatureFlagRoles,
} from './api';
import { useApp } from '@/contexts/appProvider';
import {
  useMyFeatureFlags,
  useFeatureFlag,
  useFeatureFlags,
  useCreateFeatureFlag,
  useUpdateFeatureFlag,
  useDeleteFeatureFlag,
  useSetFeatureFlagRoles,
} from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApp).mockReturnValue({ emulateError: false } as never);
});

describe('useMyFeatureFlags', () => {
  it('busca o mapa de flags do usuário logado', async () => {
    vi.mocked(getMyFeatureFlags).mockResolvedValue(ok({ beta: true }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMyFeatureFlags(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ beta: true });
  });
});

describe('useFeatureFlag', () => {
  it('devolve true quando a flag está presente no mapa', async () => {
    vi.mocked(getMyFeatureFlags).mockResolvedValue(ok({ beta: true }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useFeatureFlag('beta'), { wrapper });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('devolve false quando a flag não está no mapa (default)', async () => {
    vi.mocked(getMyFeatureFlags).mockResolvedValue(ok({ beta: true }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useFeatureFlag('ausente'), { wrapper });

    await waitFor(() => expect(getMyFeatureFlags).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});

describe('useFeatureFlags', () => {
  it('busca a lista completa de flags', async () => {
    vi.mocked(getAllFeatureFlags).mockResolvedValue(ok([{ id: 'f1', key: 'beta' }]) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'f1', key: 'beta' }]);
  });
});

describe('useCreateFeatureFlag', () => {
  it('cria a flag e sincroniza flags/capabilities e o router', async () => {
    vi.mocked(createFeatureFlag).mockResolvedValue(ok({ id: 'f1', key: 'beta' }) as never);
    const { invalidate, wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateFeatureFlag(), { wrapper });
    result.current.mutate({ key: 'beta' } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createFeatureFlag).toHaveBeenCalledWith({ key: 'beta' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['feature-flags'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['feature-flags-me'], refetchType: 'all' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['capabilities'], refetchType: 'all' });
    expect(mocks.refresh).toHaveBeenCalled();
  });
});

describe('useUpdateFeatureFlag', () => {
  it('atualiza a flag por id e sincroniza', async () => {
    vi.mocked(updateFeatureFlag).mockResolvedValue(ok({ id: 'f1', key: 'beta' }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateFeatureFlag(), { wrapper });
    result.current.mutate({ id: 'f1', dto: { enabled: true } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateFeatureFlag).toHaveBeenCalledWith('f1', { enabled: true });
    expect(mocks.refresh).toHaveBeenCalled();
  });
});

describe('useDeleteFeatureFlag', () => {
  it('remove a flag por id e sincroniza', async () => {
    vi.mocked(deleteFeatureFlag).mockResolvedValue(ok(undefined) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDeleteFeatureFlag(), { wrapper });
    result.current.mutate('f1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteFeatureFlag).toHaveBeenCalledWith('f1');
    expect(mocks.refresh).toHaveBeenCalled();
  });
});

describe('useSetFeatureFlagRoles', () => {
  it('define os roles da flag por id e sincroniza', async () => {
    vi.mocked(setFeatureFlagRoles).mockResolvedValue(ok({ id: 'f1', key: 'beta' }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSetFeatureFlagRoles(), { wrapper });
    result.current.mutate({ id: 'f1', dto: { roleNames: ['ADMIN'] } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setFeatureFlagRoles).toHaveBeenCalledWith('f1', { roleNames: ['ADMIN'] });
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
