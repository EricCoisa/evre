import { Injectable, OnModuleInit } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CapabilityRegistry } from '../capability/capability.registry';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';
import { EMAIL_CAPABILITY } from 'src/domain/mail/email-template-type.const';
import { MESSAGING_CAPABILITY } from 'src/domain/messaging/messaging.const';
import {
  notificationConfigKeys,
  notificationUserConfigKeys,
  NOTIFICATION_EMAIL_CAPABILITY,
  NOTIFICATION_WHATSAPP_CAPABILITY,
} from 'src/domain/notification/notification-config.const';
import { NOTIFICATION_ROOT_FLAG } from './use-cases/send-notification.use-case';

@Injectable()
export class NotificationCapabilities implements OnModuleInit {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly sysConfig: SystemConfigurationService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    this.capabilities.register(NOTIFICATION_EMAIL_CAPABILITY, {
      flags: [NOTIFICATION_ROOT_FLAG],
      check: async ({ resolve }) => {
        const on = await this.sysConfig.getValueOrNull(
          notificationConfigKeys.emailEnabled,
        );
        if (on !== 'true') {
          return {
            operational: false,
            reason: this.i18n.t('capability.channel_off'),
          };
        }
        return resolve(EMAIL_CAPABILITY);
      },
    });

    this.capabilities.register(NOTIFICATION_WHATSAPP_CAPABILITY, {
      flags: [NOTIFICATION_ROOT_FLAG],
      check: async ({ resolve }) => {
        const on = await this.sysConfig.getValueOrNull(
          notificationConfigKeys.whatsappEnabled,
        );
        if (on !== 'true') {
          return {
            operational: false,
            reason: this.i18n.t('capability.channel_off'),
          };
        }
        return resolve(MESSAGING_CAPABILITY);
      },
    });

    // Chave do operador (SystemConfiguration) → o recurso-folha que precisa estar vivo.
    this.capabilities.requires(notificationConfigKeys.emailEnabled, [
      EMAIL_CAPABILITY,
    ]);
    this.capabilities.requires(notificationConfigKeys.whatsappEnabled, [
      MESSAGING_CAPABILITY,
    ]);
    // Preferência do usuário (UserConfiguration) → o composto, que também checa o switch do operador.
    this.capabilities.requires(notificationUserConfigKeys.channelEmail, [
      NOTIFICATION_EMAIL_CAPABILITY,
    ]);
    this.capabilities.requires(notificationUserConfigKeys.channelWhatsapp, [
      NOTIFICATION_WHATSAPP_CAPABILITY,
    ]);
  }
}
