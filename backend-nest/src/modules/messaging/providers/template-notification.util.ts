import { NotificationService } from 'src/modules/notification/notification.service';
import { MessagingNotificationType } from 'src/domain/messaging/messaging-notification-types.const';

/** Chamado pelos dois lugares que aprendem a decisão do provider: reconcile e o check logo após submeter. */
export async function notifyTemplateReviewed(
  notifications: NotificationService,
  params: {
    status: string;
    previousStatus: string;
    templateKey: string;
    reason: string | null;
  },
): Promise<void> {
  if (params.status === params.previousStatus) return;
  if (params.status !== 'APPROVED' && params.status !== 'REJECTED') return;

  const approved = params.status === 'APPROVED';
  await notifications.notify({
    type: MessagingNotificationType.TEMPLATE_REVIEWED,
    recipients: { roleNames: ['ADMIN'] },
    title: approved
      ? `Template "${params.templateKey}" aprovado`
      : `Template "${params.templateKey}" reprovado`,
    message: params.reason ?? undefined,
    payload: { templateKey: params.templateKey, status: params.status },
    actionUrl: '/comunicacao',
  });
}
