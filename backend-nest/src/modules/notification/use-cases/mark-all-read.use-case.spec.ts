import { describe, it, expect, vi } from 'vitest';
import { MarkAllReadUseCase } from './mark-all-read.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { MaterializeBroadcastRecipientsUseCase } from './materialize-broadcast-recipients.use-case';

describe('MarkAllReadUseCase', () => {
  it('materializa broadcasts pendentes antes de marcar todas como lidas', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      notificationRecipient: { updateMany },
    } as unknown as PrismaService;
    const materializeBroadcast = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as MaterializeBroadcastRecipientsUseCase;

    await new MarkAllReadUseCase(prisma, materializeBroadcast).execute(
      'u1',
      'ADMIN',
    );

    expect(materializeBroadcast.execute).toHaveBeenCalledWith('u1', 'ADMIN');
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
