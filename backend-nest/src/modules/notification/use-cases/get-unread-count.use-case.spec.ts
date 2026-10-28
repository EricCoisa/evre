import { describe, it, expect, vi } from 'vitest';
import { GetUnreadCountUseCase } from './get-unread-count.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { MaterializeBroadcastRecipientsUseCase } from './materialize-broadcast-recipients.use-case';

describe('GetUnreadCountUseCase', () => {
  it('materializa broadcasts pendentes antes de contar', async () => {
    const count = vi.fn().mockResolvedValue(3);
    const prisma = {
      notificationRecipient: { count },
    } as unknown as PrismaService;
    const materializeBroadcast = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as MaterializeBroadcastRecipientsUseCase;

    const result = await new GetUnreadCountUseCase(
      prisma,
      materializeBroadcast,
    ).execute('u1', 'ADMIN');

    expect(materializeBroadcast.execute).toHaveBeenCalledWith('u1', 'ADMIN');
    expect(count).toHaveBeenCalledWith({
      where: { userId: 'u1', readAt: null, dismissedAt: null },
    });
    expect(result).toBe(3);
  });
});
