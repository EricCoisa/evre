import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getMyNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  dismissNotification: vi.fn(),
  sendBroadcastNotification: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  sendBroadcastNotification,
} from './api';
import { useApp } from '@/contexts/appProvider';
import {
  useUnreadCount,
  useMyNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDismissNotification,
  useSendBroadcastNotification,
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

describe('useUnreadCount', () => {
  it('busca a contagem de não lidas', async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(ok(5) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(5);
  });
});

describe('useMyNotifications', () => {
  it('busca a lista repassando os params', async () => {
    vi.mocked(getMyNotifications).mockResolvedValue(ok({ data: [{ id: 'n1' }], meta: { total: 1 } }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMyNotifications({ page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyNotifications).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data).toEqual({ data: [{ id: 'n1' }], meta: { total: 1 } });
  });
});

describe('useMarkNotificationRead', () => {
  it('marca como lida e invalida contagem e lista', async () => {
    vi.mocked(markNotificationRead).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper } = makeWrapper();

    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper });
    result.current.mutate('n1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(markNotificationRead).toHaveBeenCalledWith('n1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'unread-count'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'list'] });
  });
});

describe('useMarkAllNotificationsRead', () => {
  it('marca todas como lidas e invalida contagem e lista', async () => {
    vi.mocked(markAllNotificationsRead).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper } = makeWrapper();

    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(markAllNotificationsRead).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'unread-count'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'list'] });
  });
});

describe('useDismissNotification', () => {
  it('dispensa por id e invalida contagem e lista', async () => {
    vi.mocked(dismissNotification).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper } = makeWrapper();

    const { result } = renderHook(() => useDismissNotification(), { wrapper });
    result.current.mutate('n1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(dismissNotification).toHaveBeenCalledWith('n1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'unread-count'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'list'] });
  });
});

describe('useSendBroadcastNotification', () => {
  it('envia o broadcast e invalida contagem e lista', async () => {
    vi.mocked(sendBroadcastNotification).mockResolvedValue(ok(undefined) as never);
    const { invalidate, wrapper } = makeWrapper();
    const data = { title: 'Aviso', message: 'Mensagem', all: true, roleNames: [] };

    const { result } = renderHook(() => useSendBroadcastNotification(), { wrapper });
    result.current.mutate(data as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sendBroadcastNotification).toHaveBeenCalledWith(data);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'unread-count'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'list'] });
  });
});
