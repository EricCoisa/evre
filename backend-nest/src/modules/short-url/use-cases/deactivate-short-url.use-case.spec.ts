import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { DeactivateShortUrlUseCase } from './deactivate-short-url.use-case';

describe('DeactivateShortUrlUseCase', () => {
  let useCase: DeactivateShortUrlUseCase;
  let prisma: {
    shortLink: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let i18n: { t: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      shortLink: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    i18n = { t: vi.fn((key: string) => key) };

    useCase = new DeactivateShortUrlUseCase(
      prisma as unknown as PrismaService,
      i18n as unknown as I18nService,
    );
  });

  it('deve marcar disabledAt quando o link existe', async () => {
    prisma.shortLink.findUnique.mockResolvedValueOnce({ id: 'link-1' });
    prisma.shortLink.update.mockResolvedValueOnce({});

    await useCase.execute('slug-teste');

    expect(prisma.shortLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'slug-teste' },
        data: expect.objectContaining({ disabledAt: expect.any(Date) }),
      }),
    );
  });

  it('deve lançar NotFoundException ao desativar link inexistente', async () => {
    prisma.shortLink.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.execute('nao-existe')).rejects.toThrow(
      NotFoundException,
    );
    expect(i18n.t).toHaveBeenCalledWith('short_url.not_found');
  });
});

