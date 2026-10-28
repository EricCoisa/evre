import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingConnectionService } from '../messaging-connection.service';
import { MessagingEventsService } from '../messaging-events.service';
import { categoryChangeData } from '../providers/template.util';
import { NotificationService } from 'src/modules/notification/notification.service';
import { notifyTemplateReviewed } from '../providers/template-notification.util';

/** Puxa o estado real da WABA sob demanda quando o webhook da Meta se perde, cobrindo também a categoria. */
@Injectable()
export class ReconcileTemplateSubmissionsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: MessagingConnectionService,
    private readonly events: MessagingEventsService,
    private readonly notifications: NotificationService,
  ) {}

  async execute(connectionId: string): Promise<{ updated: number }> {
    const submissions = await this.prisma.messagingTemplateSubmission.findMany({
      where: { connectionId, providerTemplateId: { not: null } },
      include: { template: true },
    });
    if (submissions.length === 0) return { updated: 0 };

    const connection = await this.connections.getActive(connectionId);
    const provider = this.connections.use(connection);
    if (!provider.fetchTemplateStatuses) return { updated: 0 };

    const byRemoteId = new Map(
      submissions.map((s) => [s.providerTemplateId, s]),
    );
    let updated = 0;
    for (const remote of await provider.fetchTemplateStatuses()) {
      const submission = byRemoteId.get(remote.providerTemplateId);
      if (!submission) continue;

      // Só o que mudou: re-gravar o mesmo status apagaria o `reviewedAt` real.
      const statusChanged =
        submission.status !== remote.status ||
        (submission.reason ?? null) !== (remote.reason ?? null);
      if (statusChanged) {
        await this.prisma.messagingTemplateSubmission.update({
          where: { id: submission.id },
          data: {
            status: remote.status,
            reason: remote.reason ?? null,
            reviewedAt: new Date(),
          },
        });
        await notifyTemplateReviewed(this.notifications, {
          status: remote.status,
          previousStatus: submission.status,
          templateKey: submission.template.key,
          reason: remote.reason ?? null,
        });
      }

      const categoryChange = categoryChangeData(
        submission.template.category,
        remote.category,
      );
      if (categoryChange) {
        await this.prisma.messagingTemplate.update({
          where: { id: submission.templateId },
          data: categoryChange,
        });
      }
      if (statusChanged || categoryChange) updated += 1;
    }
    if (updated > 0) this.events.emit({ type: 'templates' });
    return { updated };
  }
}
