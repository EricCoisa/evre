import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MaterializeBroadcastRecipientsUseCase } from './materialize-broadcast-recipients.use-case';

@Injectable()
export class GetUnreadCountUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly materializeBroadcast: MaterializeBroadcastRecipientsUseCase,
  ) {}

  async execute(userId: string, roleName: string): Promise<number> {
    await this.materializeBroadcast.execute(userId, roleName);

    return this.prisma.notificationRecipient.count({
      where: { userId, readAt: null, dismissedAt: null },
    });
  }
}
