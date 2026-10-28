import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';

vi.mock('./api', () => ({
  getSystemConfiguration: vi.fn(),
  updateSystemConfiguration: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { getSystemConfiguration, updateSystemConfiguration } from './api';
import { useApp } from '@/contexts/appProvider';
import { toast } from 'sonner';
import { useConfiguration, useConfigurationValues, useUpdateConfiguration } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <Suspense fallback={<div>loading</div>}>{children}</Suspense>
    </QueryClientProvider>
  );
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

describe('useConfiguration', () => {
  it('busca a configuração do sistema por labelKey', async () => {
    vi.mocked(getSystemConfiguration).mockResolvedValue(ok({ id: 's1', value: 'dark' }) as never);

    const { result } = renderHook(() => useConfiguration('THEME'), { wrapper });

    await waitFor(() => expect(result.current?.data).toEqual({ id: 's1', value: 'dark' }));
    expect(getSystemConfiguration).toHaveBeenCalledWith('THEME');
  });
});

describe('useConfigurationValues', () => {
  it('busca várias chaves de uma vez e expõe values indexado por labelKey', async () => {
    vi.mocked(getSystemConfiguration).mockImplementation(
      ((key: string) => Promise.resolve(ok({ value: `v-${key}` }))) as never,
    );

    const { result } = renderHook(() => useConfigurationValues(['a', 'b']), { wrapper });

    await waitFor(() => expect(result.current?.values).toEqual({ a: 'v-a', b: 'v-b' }));
    expect(getSystemConfiguration).toHaveBeenCalledWith('a');
    expect(getSystemConfiguration).toHaveBeenCalledWith('b');
  });
});

describe('useUpdateConfiguration', () => {
  it('atualiza a configuração e invalida apenas a chave alterada', async () => {
    vi.mocked(updateSystemConfiguration).mockResolvedValue(ok({ id: 's1', value: 'dark' }) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateConfiguration(), { wrapper: clientWrapper });
    result.current.mutate({ systemConfiguration: { id: 's1', labelKey: 'THEME', value: 'dark' } } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateSystemConfiguration).toHaveBeenCalledWith('s1', 'dark');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['system-configuration', 'THEME'] });
  });

  it('emulateError=true lança erro antes de chamar a api', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateConfiguration(), { wrapper: clientWrapper });
    result.current.mutate({ systemConfiguration: { id: 's1', labelKey: 'THEME', value: 'dark' } } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(updateSystemConfiguration).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Emulated error from useSetUserConfiguration');
  });
});
