import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  listMcpConnections: vi.fn(),
  revokeMcpConnection: vi.fn(),
  getAuthorizationRequest: vi.fn(),
  approveAuthorization: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { listMcpConnections, revokeMcpConnection, getAuthorizationRequest, approveAuthorization } from './api';
import { useApp } from '@/contexts/appProvider';
import { toast } from 'sonner';
import {
  useMcpConnections,
  useRevokeMcpConnection,
  useAuthorizationRequest,
  useApproveAuthorization,
} from './queries';

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

describe('useMcpConnections', () => {
  it('lista as conexões MCP', async () => {
    vi.mocked(listMcpConnections).mockResolvedValue(ok([{ id: 'c1' }]) as never);

    const { result } = renderHook(() => useMcpConnections(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'c1' }]);
  });
});

describe('useRevokeMcpConnection', () => {
  it('revoga a conexão e invalida a lista', async () => {
    vi.mocked(revokeMcpConnection).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useRevokeMcpConnection(), { wrapper: clientWrapper });
    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(revokeMcpConnection).toHaveBeenCalledWith('c1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['mcp-connections'] });
  });

  it('emulateError=true lança erro antes de chamar a api', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useRevokeMcpConnection(), { wrapper: clientWrapper });
    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(revokeMcpConnection).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Emulated error from useRevokeMcpConnection');
  });
});

describe('useAuthorizationRequest', () => {
  it('busca o pedido de autorização quando req existe', async () => {
    vi.mocked(getAuthorizationRequest).mockResolvedValue(ok({ clientId: 'x' }) as never);

    const { result } = renderHook(() => useAuthorizationRequest('req1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAuthorizationRequest).toHaveBeenCalledWith('req1');
  });

  it('não busca quando req é null (enabled: false)', () => {
    const { result } = renderHook(() => useAuthorizationRequest(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getAuthorizationRequest).not.toHaveBeenCalled();
  });
});

describe('useApproveAuthorization', () => {
  it('aprova a autorização com os scopes', async () => {
    vi.mocked(approveAuthorization).mockResolvedValue(ok({ redirectTo: '/done' }) as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useApproveAuthorization(), { wrapper: clientWrapper });
    result.current.mutate({ req: 'req1', scopes: ['read' as never] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(approveAuthorization).toHaveBeenCalledWith('req1', ['read']);
  });

  it('emulateError=true lança erro antes de chamar a api', async () => {
    vi.mocked(useApp).mockReturnValue({ emulateError: true } as never);
    const { wrapper: clientWrapper } = makeWrapper();

    const { result } = renderHook(() => useApproveAuthorization(), { wrapper: clientWrapper });
    result.current.mutate({ req: 'req1', scopes: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(approveAuthorization).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Emulated error from useApproveAuthorization');
  });
});
