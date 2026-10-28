import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShortenUrlUseCase } from './shorten-url.use-case';

describe('ShortenUrlUseCase', () => {
  let useCase: ShortenUrlUseCase;
  let prisma: {
    shortLink: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let configService: { get: ReturnType<typeof vi.fn> };
  let i18n: { t: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      shortLink: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };
    configService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'SHORT_URL_BASE_URL') return 'https://meuapp.com';
        return null;
      }),
    };
    i18n = { t: vi.fn((key: string) => key) };

    useCase = new ShortenUrlUseCase(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      i18n as unknown as I18nService,
    );
  });

  it('deve criar um link curto com código aleatório de 8 caracteres', async () => {
    prisma.shortLink.findUnique.mockResolvedValueOnce(null);
    prisma.shortLink.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'uuid-1',
        code: data.code,
        targetUrl: data.targetUrl,
        purpose: data.purpose ?? null,
        expiresAt: data.expiresAt ?? null,
        maxClicks: data.maxClicks ?? null,
        clicksCount: 0,
        createdById: data.createdById ?? null,
        createdAt: new Date(),
      }),
    );

    const result = await useCase.execute({
      targetUrl: 'https://example.com/very/long/url?token=123456',
      purpose: 'INVITE',
      createdById: 'user-1',
    });

    expect(result.code).toHaveLength(8);
    expect(result.shortUrl).toBe(`https://meuapp.com/s/${result.code}`);
    expect(result.targetUrl).toBe(
      'https://example.com/very/long/url?token=123456',
    );
    expect(result.clicksCount).toBe(0);
    expect(prisma.shortLink.create).toHaveBeenCalledTimes(1);
  });

  it('deve lançar ConflictException quando todas as tentativas de slug colidirem', async () => {
    prisma.shortLink.findUnique.mockResolvedValue({ id: 'colisao' });

    await expect(
      useCase.execute({ targetUrl: 'https://example.com/dest' }),
    ).rejects.toThrow(ConflictException);
    expect(i18n.t).toHaveBeenCalledWith('short_url.slug_generation_failed');
  });
});

