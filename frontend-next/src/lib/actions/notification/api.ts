"use server";
// Thin adapter — wraps generated notification functions
import { getNotification as createNotificationClient } from '@/lib/generated/notification/notification';
import type { ApiResponse } from '@/lib/api/api';
import type { NotificationPage, SendBroadcastNotificationInput } from './types';
import { wrap, wrapAs } from '../wrap';

const api = createNotificationClient();

export async function getMyNotifications(params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}): Promise<ApiResponse<NotificationPage>> {
  return wrapAs(() => api.notificationControllerFindMine(params));
}

export async function getUnreadCount(): Promise<ApiResponse<number>> {
  return wrap(() => api.notificationControllerUnreadCount());
}

export async function markNotificationRead(id: string): Promise<ApiResponse<void>> {
  return wrap(() => api.notificationControllerMarkOneRead(id));
}

export async function markAllNotificationsRead(): Promise<ApiResponse<void>> {
  return wrap(() => api.notificationControllerMarkAll());
}

export async function dismissNotification(id: string): Promise<ApiResponse<void>> {
  return wrap(() => api.notificationControllerDismissOne(id));
}

/** Composer admin — ver docs/backend/notifications.md ("Gaps explícitos"). */
export async function sendBroadcastNotification(
  data: SendBroadcastNotificationInput,
): Promise<ApiResponse<void>> {
  return wrap(() => api.notificationControllerBroadcast(data));
}
