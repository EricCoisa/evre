import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';

vi.mock('./api', () => ({
  getUserConfigurationsDefinitions: vi.fn(),
  updateUserConfigurationsDefinitions: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { getUserConfigurationsDefinitions, updateUserConfigurationsDefinitions } from './api';
import { useApp } from '@/contexts/appProvider';
import { toast } from 'sonner';
import { useUserConfigurationsDefinitions, useSetUserConfigurationDefinitions } from './queries';

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

describe('useUserConfigurationsDefinitions', () => {
  it('busca a definição por labelKey', async () => {
    vi.mocked(getUserConfigurationsDefinitions).mockResolvedValue(ok({ id: 'd1', defaultValue: '10' }) as never);

    const { result } = renderHook(() => useUserConfigurationsDefinitions('SOME_KEY'), { wrapper });

    await waitFor(() => expect(result.current?.data).toEqual({ id: 'd1', defaultValue: '10' }));
    expect(getUserConfigurationsDefinitions).toHaveBeenCalledWith('SOME_KEY');
  });
});

describe('useSetUserConfigurationDefinitions', () => {
  it('salva a definição e invalida a lista geral e a chave alterada', async () => {
    vi.mocked(updateUserConfigurationsDefinitions).mockResolvedValue(ok({ id: 'd1', defaultValue: '10' }) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useSetUserConfigurationDefinitions(), { wrapper: clientWrapper });
    result.current.mutate({
      userConfigurationDefinitions: { id: 'd1', labelKey: 'SOME_KEY', defaultValue: '10' },
    } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateUserConfigurationsDefinitions).toHaveBeenCalledWith('d1', '10');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-configurations-definitions'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-configurations-definitions', 'SOME_KEY'] });
  });

  it('emulateError=true lança erro antes de chamar a api', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useSetUserConfigurationDefinitions(), { wrapper: clientWrapper });
    result.current.mutate({
      userConfigurationDefinitions: { id: 'd1', labelKey: 'SOME_KEY', defaultValue: '10' },
    } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(updateUserConfigurationsDefinitions).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Emulated error from useSetUserConfiguration');
  });
});
