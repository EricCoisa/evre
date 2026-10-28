import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FeatureFlagService } from '../../feature-flag/feature-flag.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { EmailService } from '../../email/email.service';
import { MessagingService } from '../../messaging/messaging.service';
import { VerificationService } from '../../verification/verification.service';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { EmailTemplateType } from 'src/domain/mail/email-template-type.const';
import { UserVerificationPurpose } from 'src/domain/user/user-verification-purpose.const';
import {
  notificationConfigKeys,
  notificationUserConfigKeys,
  NOTIFICATION_WHATSAPP_TEMPLATE_KEY,
} from 'src/domain/notification/notification-config.const';

export const NOTIFICATION_ROOT_FLAG = 'NOTIFICATION';

export type NotificationRecipients =
  { userIds: string[] } | { roleNames: string[] } | { all: true };

export interface SendNotificationInput {
  type: string;
  recipients: NotificationRecipients;
  title?: string;
  titleKey?: string;
  message?: string;
  messageKey?: string;
  payload?: Record<string, unknown>;
  actionUrl?: string;
  /** Os dois sempre usam o template único do canal (NOTIFICATION) — nunca um por chamador. */
  channels?: {
    email?: boolean;
    whatsapp?: boolean;
  };
  createdById?: string | null;
}

/** Facade de envio que nunca lança: falha de canal é logada e a linha in-app não depende do relay. */
@Injectable()
export class SendNotificationUseCase {
  private readonly logger = new Logger(SendNotificationUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: FeatureFlagService,
    private readonly systemConfig: SystemConfigurationService,
    private readonly emailService: EmailService,
    private readonly messagingService: MessagingService,
    private readonly verificationService: VerificationService,
  ) {}

  async execute(input: SendNotificationInput): Promise<void> {
    // roleName vazio de propósito: chamadas de outros módulos (cron, webhook) não têm role.
    const enabled = await this.featureFlags.isEnabled(
      NOTIFICATION_ROOT_FLAG,
      '',
    );
    if (!enabled) return;

    // Envio direto para uma lista explícita e pequena: sem gap de escala, materializa de uma vez.
    if (
      'userIds' in input.recipients &&
      input.recipients.userIds.length === 0
    ) {
      return;
    }

    const notification = await this.prisma.notification.create({
      data: {
        type: input.type,
        title: input.title ?? null,
        titleKey: input.titleKey ?? null,
        message: input.message ?? null,
        messageKey: input.messageKey ?? null,
        payload: (input.payload as Prisma.InputJsonValue) ?? undefined,
        actionUrl: input.actionUrl ?? null,
        createdById: input.createdById ?? null,
        audienceAll: 'all' in input.recipients,
        audienceRoleNames:
          'roleNames' in input.recipients ? input.recipients.roleNames : [],
      },
    });

    if ('userIds' in input.recipients) {
      await this.prisma.notificationRecipient.createMany({
        data: input.recipients.userIds.map((userId) => ({
          notificationId: notification.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
    // Broadcast (roleNames/all): nenhum NotificationRecipient criado aqui — materializado lazy, por
    // usuário, na primeira leitura (ver MaterializeBroadcastRecipientsUseCase). Evita o fan-out
    // síncrono de uma linha por usuário no envio (ver docs/backend/notifications.md).

    if (input.channels?.email || input.channels?.whatsapp) {
      const userIds =
        'userIds' in input.recipients
          ? input.recipients.userIds
          : await this.resolveBroadcastUserIds(input.recipients);
      if (userIds.length > 0) {
        await this.dispatchChannels(input, userIds);
      }
    }
  }

  /** Só para o relay de canal (email/WhatsApp) — esse ainda precisa de uma lista concreta de usuários. */
  private async resolveBroadcastUserIds(
    recipients: { roleNames: string[] } | { all: true },
  ): Promise<string[]> {
    const where =
      'roleNames' in recipients
        ? {
            deletedAt: null,
            status: 'ACTIVE' as const,
            roleRecord: { name: { in: recipients.roleNames } },
          }
        : { deletedAt: null, status: 'ACTIVE' as const };

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async dispatchChannels(
    input: SendNotificationInput,
    userIds: string[],
  ): Promise<void> {
    // Kill-switch de plataforma por canal (SystemConfiguration, não feature flag — é o operador
    // quem liga/desliga em runtime, não um rollout de dev) — checado uma vez aqui, não por
    // destinatário. Independente da preferência de cada usuário: desligado aqui, nenhum usuário
    // recebe por aquele canal. Chave ausente (seed não rodou) é tratada como desligada.
    const [emailValue, whatsappValue] = await Promise.all([
      input.channels?.email
        ? this.systemConfig.getValueOrNull(notificationConfigKeys.emailEnabled)
        : null,
      input.channels?.whatsapp
        ? this.systemConfig.getValueOrNull(
            notificationConfigKeys.whatsappEnabled,
          )
        : null,
    ]);
    const emailChannelOn = emailValue === 'true';
    const whatsappChannelOn = whatsappValue === 'true';
    if (!emailChannelOn && !whatsappChannelOn) return;

    const [users, prefs] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
        },
      }),
      this.loadPreferences(userIds),
    ]);

    for (const user of users) {
      const mutedTypes = prefs.mutedTypes.get(user.id) ?? [];
      if (mutedTypes.includes(input.type)) continue;

      if (emailChannelOn && user.email) {
        const emailAllowed = prefs.email.get(user.id) ?? true;
        if (emailAllowed) {
          await this.dispatchEmail(input, {
            email: user.email,
            name: user.name,
          });
        }
      }

      // Um número digitado errado (ou de outra pessoa) não deve receber notificações da conta
      // antes de confirmar que realmente o controla — consulta o VerificationModule, não uma
      // coluna própria (ver docs/backend/verification.md).
      if (whatsappChannelOn && user.phone) {
        const phoneConfirmed = await this.verificationService.isConfirmed({
          userId: user.id,
          purpose: UserVerificationPurpose.PHONE_CONFIRMATION,
          target: user.phone,
        });
        const whatsappAllowed = prefs.whatsapp.get(user.id) ?? true;
        if (phoneConfirmed && whatsappAllowed) {
          await this.dispatchWhatsapp(input, user.phone);
        }
      }
    }
  }

  private async dispatchEmail(
    input: SendNotificationInput,
    recipient: { email: string; name: string | null },
  ): Promise<void> {
    const html = await this.emailService.renderTemplate(
      EmailTemplateType.NOTIFICATION,
      {
        name: recipient.name ?? recipient.email,
        title: input.title ?? '',
        message: input.message ?? '',
        action_url: input.actionUrl ?? '',
      },
    );
    const result = await this.emailService.send({
      to: recipient.email,
      subject: input.title ?? input.type,
      html,
      performedById: input.createdById ?? null,
    });
    if (!result.status) {
      this.logger.warn(
        `Notificação por email para ${recipient.email} falhou: ${result.data}`,
      );
    }
  }

  private async dispatchWhatsapp(
    input: SendNotificationInput,
    phone: string,
  ): Promise<void> {
    await this.messagingService.trySendTemplate({
      key: NOTIFICATION_WHATSAPP_TEMPLATE_KEY,
      phone,
      values: { title: input.title ?? '', message: input.message ?? '' },
    });
  }

  /** Uma query por definição (3 no total), não por destinatário — fan-out fica O(1) em ida ao banco. */
  private async loadPreferences(userIds: string[]): Promise<{
    email: Map<string, boolean>;
    whatsapp: Map<string, boolean>;
    mutedTypes: Map<string, string[]>;
  }> {
    const definitions = await this.prisma.userConfigurationDefinition.findMany({
      where: {
        labelKey: {
          in: [
            notificationUserConfigKeys.channelEmail,
            notificationUserConfigKeys.channelWhatsapp,
            notificationUserConfigKeys.mutedTypes,
          ],
        },
      },
    });
    const byLabel = new Map(definitions.map((d) => [d.labelKey, d]));
    const definitionIds = definitions.map((d) => d.id);

    const configs = definitionIds.length
      ? await this.prisma.userConfiguration.findMany({
          where: {
            userId: { in: userIds },
            definitionId: { in: definitionIds },
          },
        })
      : [];
    const byUserAndDefinition = new Map(
      configs.map((c) => [`${c.userId}:${c.definitionId}`, c.value]),
    );

    const resolve = (userId: string, labelKey: string): unknown => {
      const definition = byLabel.get(labelKey);
      if (!definition) return undefined;
      const raw =
        byUserAndDefinition.get(`${userId}:${definition.id}`) ??
        definition.defaultValue;
      return convertValueByType(raw, definition.valueType);
    };

    const email = new Map<string, boolean>();
    const whatsapp = new Map<string, boolean>();
    const mutedTypes = new Map<string, string[]>();
    for (const userId of userIds) {
      email.set(
        userId,
        (resolve(userId, notificationUserConfigKeys.channelEmail) as boolean) ??
          true,
      );
      whatsapp.set(
        userId,
        (resolve(
          userId,
          notificationUserConfigKeys.channelWhatsapp,
        ) as boolean) ?? true,
      );
      mutedTypes.set(
        userId,
        (resolve(userId, notificationUserConfigKeys.mutedTypes) as string[]) ??
          [],
      );
    }
    return { email, whatsapp, mutedTypes };
  }
}
