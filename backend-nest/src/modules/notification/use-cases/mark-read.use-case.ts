import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MarkReadUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(userId: string, recipientId: string): Promise<void> {
    const recipient = await this.prisma.notificationRecipient.findUnique({
      where: { id: recipientId },
      select: { id: true, userId: true },
    });
    if (!recipient || recipient.userId !== userId) {
      throw new NotFoundException(this.i18n.t('notification.not_found'));
    }

    await this.prisma.notificationRecipient.update({
      where: { id: recipientId },
      data: { readAt: new Date() },
    });
  }
}
