import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  notificationControllerFindMine: vi.fn(),
  notificationControllerUnreadCount: vi.fn(),
  notificationControllerMarkOneRead: vi.fn(),
  notificationControllerMarkAll: vi.fn(),
  notificationControllerDismissOne: vi.fn(),
  notificationControllerBroadcast: vi.fn(),
}));

vi.mock('@/lib/generated/notification/notification', () => ({
  getNotification: () => mockApi,
}));

import {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  sendBroadcastNotification,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMyNotifications', () => {
  it('busca notificações repassando os params', async () => {
    mockApi.notificationControllerFindMine.mockResolvedValue({ data: [{ id: 'n1' }], meta: { total: 1 } });

    const result = await getMyNotifications({ page: 1, limit: 10, unreadOnly: true });

    expect(mockApi.notificationControllerFindMine).toHaveBeenCalledWith({ page: 1, limit: 10, unreadOnly: true });
    expect(result).toMatchObject({ success: true, data: { data: [{ id: 'n1' }], meta: { total: 1 } } });
  });

  it('sem params: chama a API com undefined', async () => {
    mockApi.notificationControllerFindMine.mockResolvedValue({ data: [], meta: { total: 0 } });

    await getMyNotifications();

    expect(mockApi.notificationControllerFindMine).toHaveBeenCalledWith(undefined);
  });
});

describe('getUnreadCount', () => {
  it('devolve a contagem de não lidas', async () => {
    mockApi.notificationControllerUnreadCount.mockResolvedValue(3);

    const result = await getUnreadCount();

    expect(result).toMatchObject({ success: true, data: 3 });
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.notificationControllerUnreadCount.mockRejectedValue(new Error('boom'));

    const result = await getUnreadCount();

    expect(result.success).toBe(false);
  });
});

describe('markNotificationRead', () => {
  it('marca uma notificação como lida por id', async () => {
    mockApi.notificationControllerMarkOneRead.mockResolvedValue(undefined);

    const result = await markNotificationRead('n1');

    expect(mockApi.notificationControllerMarkOneRead).toHaveBeenCalledWith('n1');
    expect(result.success).toBe(true);
  });
});

describe('markAllNotificationsRead', () => {
  it('marca todas as notificações como lidas', async () => {
    mockApi.notificationControllerMarkAll.mockResolvedValue(undefined);

    const result = await markAllNotificationsRead();

    expect(mockApi.notificationControllerMarkAll).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

describe('dismissNotification', () => {
  it('dispensa uma notificação por id', async () => {
    mockApi.notificationControllerDismissOne.mockResolvedValue(undefined);

    const result = await dismissNotification('n1');

    expect(mockApi.notificationControllerDismissOne).toHaveBeenCalledWith('n1');
    expect(result.success).toBe(true);
  });
});

describe('sendBroadcastNotification', () => {
  it('envia o broadcast repassando os dados', async () => {
    mockApi.notificationControllerBroadcast.mockResolvedValue(undefined);
    const data = { title: 'Aviso', message: 'Mensagem', all: true, roleNames: [] };

    const result = await sendBroadcastNotification(data as never);

    expect(mockApi.notificationControllerBroadcast).toHaveBeenCalledWith(data);
    expect(result.success).toBe(true);
  });
});
