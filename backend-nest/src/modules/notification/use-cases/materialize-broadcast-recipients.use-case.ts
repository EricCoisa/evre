import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/** Converte a audiência implícita de um broadcast em linhas de NotificationRecipient, só para o usuário que está lendo agora. */
@Injectable()
export class MaterializeBroadcastRecipientsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string, roleName: string): Promise<void> {
    const pending = await this.prisma.notification.findMany({
      where: {
        OR: [{ audienceAll: true }, { audienceRoleNames: { has: roleName } }],
        recipients: { none: { userId } },
      },
      select: { id: true, createdAt: true },
    });
    if (pending.length === 0) return;

    await this.prisma.notificationRecipient.createMany({
      data: pending.map((notification) => ({
        notificationId: notification.id,
        userId,
        createdAt: notification.createdAt,
      })),
      skipDuplicates: true,
    });
  }
}
