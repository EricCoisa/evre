import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  sendBroadcastNotification,
} from './api';
import { Alive, Collector } from '@/lib/api/collector';

const UNREAD_COUNT_KEY = ['notifications', 'unread-count'];
const LIST_KEY = ['notifications', 'list'];

/** Polling simples (30s) — ver gap documentado: upgrade para SSE se precisar de tempo real. */
export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: Collector(getUnreadCount),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMyNotifications(params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: Collector(() => getMyNotifications(params)),
  });
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    queryClient.invalidateQueries({ queryKey: LIST_KEY });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => Alive(() => markNotificationRead(id))(),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => Alive(() => markAllNotificationsRead())(),
    onSuccess: invalidate,
  });
}

export function useDismissNotification() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => Alive(() => dismissNotification(id))(),
    onSuccess: invalidate,
  });
}

export function useSendBroadcastNotification() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (data: Parameters<typeof sendBroadcastNotification>[0]) =>
      Alive(() => sendBroadcastNotification(data))(),
    onSuccess: invalidate,
  });
}
