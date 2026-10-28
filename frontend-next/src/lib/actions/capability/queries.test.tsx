import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({ getCapabilities: vi.fn() }));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { getCapabilities } from './api';
import { useApp } from '@/contexts/appProvider';
import { CAPABILITIES, CAPABILITY_FIX_PATH } from '@/types/capabilities';
import { useCapabilities, useCapability, useSyncOnCapabilitiesChange } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApp).mockReturnValue({ emulateError: false } as never);
});

describe('useCapabilities', () => {
  it('busca o mapa de capabilities', async () => {
    vi.mocked(getCapabilities).mockResolvedValue(ok({ EMAIL: { available: true, operational: true } }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCapabilities(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ EMAIL: { available: true, operational: true } });
  });
});

describe('useCapability', () => {
  it('sem dado para a capability: não esconde, não desabilita, sem reason', async () => {
    vi.mocked(getCapabilities).mockResolvedValue(ok({}) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCapability('bogus'), { wrapper });

    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    expect(result.current.hidden).toBe(false);
    expect(result.current.disabled).toBe(false);
    expect(result.current.reason).toBeUndefined();
  });

  it('available=false esconde a capability', async () => {
    vi.mocked(getCapabilities).mockResolvedValue(
      ok({ [CAPABILITIES.email]: { available: false, operational: true } }) as never,
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCapability(CAPABILITIES.email), { wrapper });

    await waitFor(() => expect(result.current.hidden).toBe(true));
  });

  it('operational=false desabilita e expõe o reason', async () => {
    vi.mocked(getCapabilities).mockResolvedValue(
      ok({ [CAPABILITIES.email]: { available: true, operational: false, reason: 'provider fora' } }) as never,
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCapability(CAPABILITIES.email), { wrapper });

    await waitFor(() => expect(result.current.disabled).toBe(true));
    expect(result.current.reason).toBe('provider fora');
  });

  it('expõe o fixPath mapeado para a capability', async () => {
    vi.mocked(getCapabilities).mockResolvedValue(
      ok({ [CAPABILITIES.email]: { available: true, operational: true } }) as never,
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCapability(CAPABILITIES.email), { wrapper });

    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    expect(result.current.fixPath).toBe(CAPABILITY_FIX_PATH[CAPABILITIES.email]);
  });
});

describe('useSyncOnCapabilitiesChange', () => {
  it('não invalida enquanto capabilities ainda não resolveu nesta sessão', async () => {
    vi.mocked(getCapabilities).mockReturnValue(new Promise(() => {}) as never);
    const { client, invalidate, wrapper } = makeWrapper();
    client.setQueryData(['target'], 'old', { updatedAt: 1000 });

    renderHook(() => useSyncOnCapabilitiesChange(['target']), { wrapper });
    await new Promise((r) => setTimeout(r, 0));

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalida quando o cache de destino é mais antigo que o de capabilities', async () => {
    const now = Date.now();
    const { client, invalidate, wrapper } = makeWrapper();
    client.setQueryData(['capabilities'], { EMAIL: { available: true, operational: true } }, { updatedAt: now - 1000 });
    client.setQueryData(['target'], 'old', { updatedAt: now - 50_000 });

    renderHook(() => useSyncOnCapabilitiesChange(['target']), { wrapper });

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['target'], refetchType: 'all' }),
    );
    expect(getCapabilities).not.toHaveBeenCalled();
  });

  it('não invalida quando o cache de destino já é mais novo que capabilities', async () => {
    const now = Date.now();
    const { client, invalidate, wrapper } = makeWrapper();
    client.setQueryData(['capabilities'], { EMAIL: { available: true, operational: true } }, { updatedAt: now - 1000 });
    client.setQueryData(['target'], 'fresh', { updatedAt: now });

    renderHook(() => useSyncOnCapabilitiesChange(['target']), { wrapper });
    await new Promise((r) => setTimeout(r, 0));

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('não invalida quando o cache de destino não existe', async () => {
    const now = Date.now();
    const { client, invalidate, wrapper } = makeWrapper();
    client.setQueryData(['capabilities'], { EMAIL: { available: true, operational: true } }, { updatedAt: now - 1000 });

    renderHook(() => useSyncOnCapabilitiesChange(['target-inexistente']), { wrapper });
    await new Promise((r) => setTimeout(r, 0));

    expect(invalidate).not.toHaveBeenCalled();
  });
});
