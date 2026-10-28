import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DismissNotificationUseCase } from './dismiss.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';

describe('DismissNotificationUseCase', () => {
  const i18n = { t: vi.fn().mockReturnValue('not found') } as unknown as I18nService;

  it('lança NotFoundException quando o recipient não pertence ao usuário', async () => {
    const prisma = {
      notificationRecipient: {
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', userId: 'other' }),
      },
    } as unknown as PrismaService;

    await expect(
      new DismissNotificationUseCase(prisma, i18n).execute('u1', 'r1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('marca dismissedAt quando o recipient pertence ao usuário', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      notificationRecipient: {
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', userId: 'u1' }),
        update,
      },
    } as unknown as PrismaService;

    await new DismissNotificationUseCase(prisma, i18n).execute('u1', 'r1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { dismissedAt: expect.any(Date) },
    });
  });
});
