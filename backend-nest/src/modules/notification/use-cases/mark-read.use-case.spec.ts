import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MarkReadUseCase } from './mark-read.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';

describe('MarkReadUseCase', () => {
  const i18n = { t: vi.fn().mockReturnValue('not found') } as unknown as I18nService;

  it('lança NotFoundException quando o recipient não existe', async () => {
    const prisma = {
      notificationRecipient: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(
      new MarkReadUseCase(prisma, i18n).execute('u1', 'r1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança NotFoundException quando o recipient pertence a outro usuário', async () => {
    const prisma = {
      notificationRecipient: {
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', userId: 'other' }),
      },
    } as unknown as PrismaService;

    await expect(
      new MarkReadUseCase(prisma, i18n).execute('u1', 'r1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('marca readAt quando o recipient pertence ao usuário', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      notificationRecipient: {
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', userId: 'u1' }),
        update,
      },
    } as unknown as PrismaService;

    await new MarkReadUseCase(prisma, i18n).execute('u1', 'r1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { readAt: expect.any(Date) },
    });
  });
});
