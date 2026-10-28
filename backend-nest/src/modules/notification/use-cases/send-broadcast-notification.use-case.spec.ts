import { describe, it, expect, vi } from 'vitest';
import { SendBroadcastNotificationUseCase } from './send-broadcast-notification.use-case';
import type { NotificationService } from '../notification.service';

describe('SendBroadcastNotificationUseCase', () => {
  it('envia para todos quando all=true, ignorando roleNames', async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const notificationService = { notify } as unknown as NotificationService;

    await new SendBroadcastNotificationUseCase(notificationService).execute(
      {
        title: 'Aviso',
        message: 'Mensagem',
        all: true,
        roleNames: ['ADMIN'],
      },
      'admin-1',
    );

    expect(notify).toHaveBeenCalledWith({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { all: true },
      title: 'Aviso',
      message: 'Mensagem',
      actionUrl: undefined,
      createdById: 'admin-1',
      channels: { email: true, whatsapp: true },
    });
  });

  it('envia por roleNames quando all=false', async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const notificationService = { notify } as unknown as NotificationService;

    await new SendBroadcastNotificationUseCase(notificationService).execute(
      {
        title: 'Aviso',
        message: 'Mensagem',
        actionUrl: '/settings',
        all: false,
        roleNames: ['ADMIN', 'MODERATOR'],
      },
      'admin-1',
    );

    expect(notify).toHaveBeenCalledWith({
      type: 'SYSTEM_ANNOUNCEMENT',
      recipients: { roleNames: ['ADMIN', 'MODERATOR'] },
      title: 'Aviso',
      message: 'Mensagem',
      actionUrl: '/settings',
      createdById: 'admin-1',
      channels: { email: true, whatsapp: true },
    });
  });
});
