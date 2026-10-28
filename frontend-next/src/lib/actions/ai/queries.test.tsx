import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  getAiModels: vi.fn(),
  listCandidateAiModels: vi.fn(),
  getAiTools: vi.fn(),
  getAiToolPermissions: vi.fn(),
  revokeAiToolAccess: vi.fn(),
  allowAiToolAccess: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import {
  listConversations,
  createConversation,
  deleteConversation,
  getAiModels,
  listCandidateAiModels,
  getAiTools,
  getAiToolPermissions,
  revokeAiToolAccess,
  allowAiToolAccess,
} from './api';
import { useApp } from '@/contexts/appProvider';
import {
  useAiConversationList,
  useAiModels,
  useCandidateAiModels,
  useCreateConversation,
  useDeleteConversation,
  useAiTools,
  useAiToolPermissions,
  useRevokeAiToolAccess,
  useAllowAiToolAccess,
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

describe('useAiConversationList', () => {
  it('lista as conversas', async () => {
    vi.mocked(listConversations).mockResolvedValue(ok({ data: [{ id: 'c1' }] }) as never);

    const { result } = renderHook(() => useAiConversationList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ data: [{ id: 'c1' }] });
  });
});

describe('useAiModels', () => {
  it('lista os modelos configurados', async () => {
    vi.mocked(getAiModels).mockResolvedValue(ok({ models: ['gpt-4'], default: 'gpt-4' }) as never);

    const { result } = renderHook(() => useAiModels(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAiModels).toHaveBeenCalled();
  });
});

describe('useCandidateAiModels', () => {
  it('busca modelos candidatos quando há provider', async () => {
    vi.mocked(listCandidateAiModels).mockResolvedValue(ok({ models: ['gpt-4'] }) as never);

    const { result } = renderHook(() => useCandidateAiModels('openai'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listCandidateAiModels).toHaveBeenCalledWith({ provider: 'openai' });
  });

  it('não busca quando provider é null (enabled: false)', () => {
    const { result } = renderHook(() => useCandidateAiModels(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(listCandidateAiModels).not.toHaveBeenCalled();
  });
});

describe('useCreateConversation', () => {
  it('cria conversa e invalida a lista', async () => {
    vi.mocked(createConversation).mockResolvedValue(ok('new-id') as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateConversation(), { wrapper: clientWrapper });
    result.current.mutate({ title: 'oi' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createConversation).toHaveBeenCalledWith({ title: 'oi' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ai', 'conversations'] });
  });
});

describe('useDeleteConversation', () => {
  it('apaga conversa e invalida a lista', async () => {
    vi.mocked(deleteConversation).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useDeleteConversation(), { wrapper: clientWrapper });
    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteConversation).toHaveBeenCalledWith('c1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ai', 'conversations'] });
  });
});

describe('useAiTools', () => {
  it('lista as tools disponíveis', async () => {
    vi.mocked(getAiTools).mockResolvedValue(ok([{ name: 'search', description: 'busca' }]) as never);

    const { result } = renderHook(() => useAiTools(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ name: 'search', description: 'busca' }]);
  });
});

describe('useAiToolPermissions', () => {
  it('lista as permissões de tool via suspense query', async () => {
    vi.mocked(getAiToolPermissions).mockResolvedValue(ok([
      { name: 'search', description: 'busca', descriptionKey: 'searchDesc', group: 'web', enabled: true },
    ]) as never);

    const { result } = renderHook(() => useAiToolPermissions(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([
      { name: 'search', description: 'busca', descriptionKey: 'searchDesc', group: 'web', enabled: true },
    ]));
    expect(getAiToolPermissions).toHaveBeenCalled();
  });
});

describe('useRevokeAiToolAccess', () => {
  it('revoga acesso e invalida as permissões', async () => {
    vi.mocked(revokeAiToolAccess).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useRevokeAiToolAccess(), { wrapper: clientWrapper });
    result.current.mutate('search');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(revokeAiToolAccess).toHaveBeenCalledWith('search');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ai', 'tools', 'permissions'] });
  });
});

describe('useAllowAiToolAccess', () => {
  it('concede acesso e invalida as permissões', async () => {
    vi.mocked(allowAiToolAccess).mockResolvedValue(ok({
      name: 'search', description: 'busca', descriptionKey: 'searchDesc', group: 'web', enabled: true,
    }) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useAllowAiToolAccess(), { wrapper: clientWrapper });
    result.current.mutate('search');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(allowAiToolAccess).toHaveBeenCalledWith('search');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ai', 'tools', 'permissions'] });
  });
});
