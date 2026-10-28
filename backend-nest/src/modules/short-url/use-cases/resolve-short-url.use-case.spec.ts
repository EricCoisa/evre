import { GoneException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResolveShortUrlUseCase } from './resolve-short-url.use-case';

describe('ResolveShortUrlUseCase', () => {
  let useCase: ResolveShortUrlUseCase;
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

    useCase = new ResolveShortUrlUseCase(
      prisma as unknown as PrismaService,
      i18n as unknown as I18nService,
    );
  });

  it('deve resolver a URL de destino e incrementar o contador de cliques', async () => {
    prisma.shortLink.findUnique.mockResolvedValueOnce({
      id: 'link-1',
      code: 'abc12345',
      targetUrl: 'https://example.com/original',
      disabledAt: null,
      expiresAt: null,
      maxClicks: null,
      clicksCount: 3,
    });
    prisma.shortLink.update.mockResolvedValueOnce({});

    const targetUrl = await useCase.execute('abc12345');

    expect(targetUrl).toBe('https://example.com/original');
    expect(prisma.shortLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { clicksCount: { increment: 1 } },
    });
  });

  it('deve lançar NotFoundException se o código não existir', async () => {
    prisma.shortLink.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.execute('inexistente')).rejects.toThrow(
      NotFoundException,
    );
    expect(i18n.t).toHaveBeenCalledWith('short_url.not_found');
  });

  it('deve lançar GoneException se o link estiver desativado', async () => {
    prisma.shortLink.findUnique.mockResolvedValueOnce({
      id: 'link-1',
      code: 'desativado',
      targetUrl: 'https://example.com',
      disabledAt: new Date(),
      expiresAt: null,
      maxClicks: null,
      clicksCount: 0,
    });

    await expect(useCase.execute('desativado')).rejects.toThrow(GoneException);
    expect(i18n.t).toHaveBeenCalledWith('short_url.disabled');
  });

  it('deve lançar GoneException se o link estiver expirado', async () => {
    prisma.shortLink.findUnique.mockResolvedValueOnce({
      id: 'link-1',
      code: 'expirado',
      targetUrl: 'https://example.com',
      disabledAt: null,
      expiresAt: new Date(Date.now() - 10000),
      maxClicks: null,
      clicksCount: 0,
    });

    await expect(useCase.execute('expirado')).rejects.toThrow(GoneException);
    expect(i18n.t).toHaveBeenCalledWith('short_url.expired');
  });

  it('deve lançar GoneException se atingir o limite maxClicks', async () => {
    prisma.shortLink.findUnique.mockResolvedValueOnce({
      id: 'link-1',
      code: 'limite-atingido',
      targetUrl: 'https://example.com',
      disabledAt: null,
      expiresAt: null,
      maxClicks: 5,
      clicksCount: 5,
    });

    await expect(useCase.execute('limite-atingido')).rejects.toThrow(
      GoneException,
    );
    expect(i18n.t).toHaveBeenCalledWith('short_url.max_clicks_reached');
  });
});

