import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';

vi.mock('./api', () => ({
  getUserConfigurations: vi.fn(),
  getUserConfigurationByLabelKey: vi.fn(),
  setUserConfiguration: vi.fn(),
  resetUserConfiguration: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import {
  getUserConfigurations,
  getUserConfigurationByLabelKey,
  setUserConfiguration,
  resetUserConfiguration,
} from './api';
import { useApp } from '@/contexts/appProvider';
import { toast } from 'sonner';
import {
  useUserConfigurations,
  useUserConfiguration,
  useUserConfigurationValues,
  useSetUserConfiguration,
  useResetUserConfiguration,
} from './queries';

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

describe('useUserConfigurations', () => {
  it('busca todas as configurações do usuário', async () => {
    vi.mocked(getUserConfigurations).mockResolvedValue(ok([{ id: 'c1' }]) as never);

    const { result } = renderHook(() => useUserConfigurations(), { wrapper });

    await waitFor(() => expect(result.current?.data).toEqual([{ id: 'c1' }]));
    expect(getUserConfigurations).toHaveBeenCalled();
  });
});

describe('useUserConfiguration', () => {
  it('busca configuração específica por labelKey', async () => {
    vi.mocked(getUserConfigurationByLabelKey).mockResolvedValue(ok({ id: 'c1', value: 'v' }) as never);

    const { result } = renderHook(() => useUserConfiguration('SOME_KEY'), { wrapper });

    await waitFor(() => expect(result.current?.data).toEqual({ id: 'c1', value: 'v' }));
    expect(getUserConfigurationByLabelKey).toHaveBeenCalledWith('SOME_KEY');
  });
});

describe('useUserConfigurationValues', () => {
  it('busca várias chaves de uma vez e expõe values indexado por labelKey', async () => {
    vi.mocked(getUserConfigurationByLabelKey).mockImplementation(
      ((key: string) => Promise.resolve(ok({ value: `v-${key}` }))) as never,
    );

    const { result } = renderHook(() => useUserConfigurationValues(['a', 'b']), { wrapper });

    await waitFor(() => expect(result.current?.values).toEqual({ a: 'v-a', b: 'v-b' }));
    expect(getUserConfigurationByLabelKey).toHaveBeenCalledWith('a');
    expect(getUserConfigurationByLabelKey).toHaveBeenCalledWith('b');
  });
});

describe('useSetUserConfiguration', () => {
  it('salva a configuração e invalida a lista geral e a chave alterada', async () => {
    vi.mocked(setUserConfiguration).mockResolvedValue(ok({ id: 'c1', value: 'v' }) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useSetUserConfiguration(), { wrapper: clientWrapper });
    result.current.mutate({ userConfiguration: { id: 'c1', labelKey: 'SOME_KEY', value: 'v' } } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setUserConfiguration).toHaveBeenCalledWith('c1', 'v');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-configurations'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-configuration', 'SOME_KEY'] });
  });

  it('emulateError=true lança erro antes de chamar a api', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useSetUserConfiguration(), { wrapper: clientWrapper });
    result.current.mutate({ userConfiguration: { id: 'c1', labelKey: 'SOME_KEY', value: 'v' } } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(setUserConfiguration).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Emulated error from useSetUserConfiguration');
  });
});

describe('useResetUserConfiguration', () => {
  it('reseta a configuração por id e invalida a lista geral e o cache de configuração', async () => {
    vi.mocked(resetUserConfiguration).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useResetUserConfiguration(), { wrapper: clientWrapper });
    result.current.mutate('def1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resetUserConfiguration).toHaveBeenCalledWith('def1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-configurations'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-configuration'] });
  });

  it('emulateError=true lança erro antes de chamar a api', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useResetUserConfiguration(), { wrapper: clientWrapper });
    result.current.mutate('def1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(resetUserConfiguration).not.toHaveBeenCalled();
  });
});
