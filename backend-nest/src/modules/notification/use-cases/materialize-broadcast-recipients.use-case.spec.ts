import { describe, it, expect, vi } from 'vitest';
import { MaterializeBroadcastRecipientsUseCase } from './materialize-broadcast-recipients.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';

describe('MaterializeBroadcastRecipientsUseCase', () => {
  it('não toca no banco quando não há broadcast pendente para o usuário', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const createMany = vi.fn();
    const prisma = {
      notification: { findMany },
      notificationRecipient: { createMany },
    } as unknown as PrismaService;

    await new MaterializeBroadcastRecipientsUseCase(prisma).execute('u1', 'ADMIN');

    expect(findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ audienceAll: true }, { audienceRoleNames: { has: 'ADMIN' } }],
        recipients: { none: { userId: 'u1' } },
      },
      select: { id: true, createdAt: true },
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('materializa um NotificationRecipient por broadcast pendente, com createdAt copiado do evento', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: 'n1', createdAt }, { id: 'n2', createdAt }]);
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      notification: { findMany },
      notificationRecipient: { createMany },
    } as unknown as PrismaService;

    await new MaterializeBroadcastRecipientsUseCase(prisma).execute('u1', 'ADMIN');

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { notificationId: 'n1', userId: 'u1', createdAt },
        { notificationId: 'n2', userId: 'u1', createdAt },
      ],
      skipDuplicates: true,
    });
  });
});
