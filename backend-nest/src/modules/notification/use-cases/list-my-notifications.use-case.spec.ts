import { describe, it, expect, vi } from 'vitest';
import { ListMyNotificationsUseCase } from './list-my-notifications.use-case';
import { MaterializeBroadcastRecipientsUseCase } from './materialize-broadcast-recipients.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';

const materializeBroadcast = {
  execute: vi.fn().mockResolvedValue(undefined),
} as unknown as MaterializeBroadcastRecipientsUseCase;

describe('ListMyNotificationsUseCase', () => {
  it('resolve titleKey/messageKey via i18n quando presentes', async () => {
    const row = {
      readAt: null,
      dismissedAt: null,
      notification: {
        id: 'n1',
        type: 'SYSTEM_ANNOUNCEMENT',
        titleKey: 'notification.types.title',
        title: null,
        messageKey: null,
        message: 'texto fixo',
        payload: { name: 'Ana' },
        actionUrl: null,
        createdAt: new Date('2026-01-01'),
      },
    };
    const prisma = {
      notificationRecipient: {
        findMany: vi.fn().mockResolvedValue([row]),
        count: vi.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;
    const i18n = {
      t: vi.fn().mockReturnValue('Olá Ana'),
    } as unknown as I18nService;

    const result = await new ListMyNotificationsUseCase(
      prisma,
      i18n,
      materializeBroadcast,
    ).execute(
      'u1',
      'USER',
      { page: 1, limit: 10, pagination: true, search: undefined, filter: undefined },
      false,
    );

    expect(i18n.t).toHaveBeenCalledWith('notification.types.title', {
      args: { name: 'Ana' },
      defaultValue: 'notification.types.title',
    });
    const data = Array.isArray(result) ? result : result.data;
    expect(data[0]).toMatchObject({ title: 'Olá Ana', message: 'texto fixo' });
  });

  it('usa título/mensagem em texto livre quando não há key', async () => {
    const row = {
      readAt: new Date('2026-01-02'),
      dismissedAt: null,
      notification: {
        id: 'n2',
        type: 'SYSTEM_ANNOUNCEMENT',
        titleKey: null,
        title: 'Título livre',
        messageKey: null,
        message: 'Mensagem livre',
        payload: null,
        actionUrl: null,
        createdAt: new Date('2026-01-01'),
      },
    };
    const prisma = {
      notificationRecipient: {
        findMany: vi.fn().mockResolvedValue([row]),
        count: vi.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;
    const i18n = { t: vi.fn() } as unknown as I18nService;

    const result = await new ListMyNotificationsUseCase(
      prisma,
      i18n,
      materializeBroadcast,
    ).execute(
      'u1',
      'USER',
      { page: 1, limit: 10, pagination: true, search: undefined, filter: undefined },
      false,
    );

    expect(i18n.t).not.toHaveBeenCalled();
    const data = Array.isArray(result) ? result : result.data;
    expect(data[0]).toMatchObject({
      title: 'Título livre',
      message: 'Mensagem livre',
      readAt: row.readAt,
    });
  });

  it('filtra só não lidas quando unreadOnly=true', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      notificationRecipient: { findMany, count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const i18n = { t: vi.fn() } as unknown as I18nService;

    await new ListMyNotificationsUseCase(prisma, i18n, materializeBroadcast).execute(
      'u1',
      'USER',
      { page: 1, limit: 10, pagination: true, search: undefined, filter: undefined },
      true,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', dismissedAt: null, readAt: null },
      }),
    );
  });

  it('materializa os broadcasts pendentes do usuário antes de listar', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      notificationRecipient: { findMany, count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const i18n = { t: vi.fn() } as unknown as I18nService;

    await new ListMyNotificationsUseCase(prisma, i18n, materializeBroadcast).execute(
      'u1',
      'ADMIN',
      { page: 1, limit: 10, pagination: true, search: undefined, filter: undefined },
      false,
    );

    expect(materializeBroadcast.execute).toHaveBeenCalledWith('u1', 'ADMIN');
  });
});
