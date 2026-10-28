import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
  updateApiKeyScopes: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { createApiKey, listApiKeys, revokeApiKey, updateApiKeyScopes } from './api';
import { useApp } from '@/contexts/appProvider';
import { toast } from 'sonner';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useUpdateApiKeyScopes } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const clientWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper: clientWrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApp).mockReturnValue({ emulateError: false } as never);
});

describe('useApiKeys', () => {
  it('lista as api keys', async () => {
    vi.mocked(listApiKeys).mockResolvedValue(ok([{ id: 'k1' }]) as never);

    const { result } = renderHook(() => useApiKeys(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'k1' }]);
  });
});

describe('useCreateApiKey', () => {
  it('cria a api key e invalida a lista', async () => {
    vi.mocked(createApiKey).mockResolvedValue(ok({ id: 'k1', rawKey: 'raw' }) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateApiKey(), { wrapper: clientWrapper });
    const dto = { name: 'ci', scopes: [] };
    result.current.mutate(dto);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createApiKey).toHaveBeenCalledWith(dto);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['api-keys'] });
  });

  it('emulateError=true lança erro antes de chamar a api', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateApiKey(), { wrapper: clientWrapper });
    result.current.mutate({ name: 'ci', scopes: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(createApiKey).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Emulated error from useCreateApiKey');
  });
});

describe('useRevokeApiKey', () => {
  it('revoga a api key e invalida a lista', async () => {
    vi.mocked(revokeApiKey).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useRevokeApiKey(), { wrapper: clientWrapper });
    result.current.mutate('k1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(revokeApiKey).toHaveBeenCalledWith('k1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['api-keys'] });
  });
});

describe('useUpdateApiKeyScopes', () => {
  it('atualiza os scopes e invalida a lista', async () => {
    vi.mocked(updateApiKeyScopes).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateApiKeyScopes(), { wrapper: clientWrapper });
    result.current.mutate({ id: 'k1', scopes: ['write' as never] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateApiKeyScopes).toHaveBeenCalledWith('k1', ['write']);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['api-keys'] });
  });
});
