import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MaterializeBroadcastRecipientsUseCase } from './materialize-broadcast-recipients.use-case';

@Injectable()
export class MarkAllReadUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly materializeBroadcast: MaterializeBroadcastRecipientsUseCase,
  ) {}

  async execute(userId: string, roleName: string): Promise<void> {
    // Materializa antes de marcar: sem isso, um broadcast nunca lido ficaria de fora do "ler todas".
    await this.materializeBroadcast.execute(userId, roleName);

    await this.prisma.notificationRecipient.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
