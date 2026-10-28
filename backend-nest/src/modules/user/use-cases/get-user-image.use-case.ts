import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class GetUserImageUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(id: string): Promise<Buffer | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { image: true },
    });
    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }
    if (!user.image) return null;
    return Buffer.isBuffer(user.image) ? user.image : Buffer.from(user.image);
  }
}
