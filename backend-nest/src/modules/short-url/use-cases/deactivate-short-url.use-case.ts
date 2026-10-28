import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DeactivateShortUrlUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(code: string): Promise<void> {
    const existing = await this.prisma.shortLink.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(this.i18n.t('short_url.not_found'));
    }

    await this.prisma.shortLink.update({
      where: { code },
      data: {
        disabledAt: new Date(),
      },
    });
  }
}
