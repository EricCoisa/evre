import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';

const BASE62_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export interface ShortenUrlInput {
  targetUrl: string;
  purpose?: string;
  expiresAt?: Date;
  maxClicks?: number;
  createdById?: string | null;
}

export interface ShortenUrlOutput {
  id: string;
  code: string;
  shortUrl: string;
  targetUrl: string;
  purpose: string | null;
  clicksCount: number;
  maxClicks: number | null;
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ShortenUrlUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async execute(input: ShortenUrlInput): Promise<ShortenUrlOutput> {
    const code = await this.generateUniqueSlug();

    const shortLink = await this.prisma.shortLink.create({
      data: {
        code,
        targetUrl: input.targetUrl,
        purpose: input.purpose,
        expiresAt: input.expiresAt,
        maxClicks: input.maxClicks,
        createdById: input.createdById ?? null,
      },
    });

    return {
      id: shortLink.id,
      code: shortLink.code,
      shortUrl: this.buildShortUrl(shortLink.code),
      targetUrl: shortLink.targetUrl,
      purpose: shortLink.purpose,
      clicksCount: shortLink.clicksCount,
      maxClicks: shortLink.maxClicks,
      expiresAt: shortLink.expiresAt,
      createdAt: shortLink.createdAt,
    };
  }

  private async generateUniqueSlug(maxAttempts = 5): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const slug = this.randomBase62(8);
      const existing = await this.prisma.shortLink.findUnique({
        where: { code: slug },
        select: { id: true },
      });
      if (!existing) {
        return slug;
      }
    }
    throw new ConflictException(
      this.i18n.t('short_url.slug_generation_failed'),
    );
  }

  private randomBase62(length: number): string {
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
    }
    return result;
  }

  private buildShortUrl(code: string): string {
    const base =
      this.configService.get<string>('SHORT_URL_BASE_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000';
    const cleanBase = base.replace(/\/+$/, '');
    return `${cleanBase}/s/${code}`;
  }
}
