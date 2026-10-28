import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ResolveShortUrlUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(code: string): Promise<string> {
    const shortLink = await this.prisma.shortLink.findUnique({
      where: { code },
    });

    if (!shortLink) {
      throw new NotFoundException(this.i18n.t('short_url.not_found'));
    }

    if (shortLink.disabledAt) {
      throw new GoneException(this.i18n.t('short_url.disabled'));
    }

    if (shortLink.expiresAt && shortLink.expiresAt.getTime() < Date.now()) {
      throw new GoneException(this.i18n.t('short_url.expired'));
    }

    if (
      shortLink.maxClicks !== null &&
      shortLink.clicksCount >= shortLink.maxClicks
    ) {
      throw new GoneException(this.i18n.t('short_url.max_clicks_reached'));
    }

    await this.prisma.shortLink.update({
      where: { id: shortLink.id },
      data: {
        clicksCount: {
          increment: 1,
        },
      },
    });

    return shortLink.targetUrl;
  }
}
