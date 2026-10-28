import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { VerificationChannel } from '@prisma/client';
import { CapabilityRegistry } from '../../capability/capability.registry';
import { MessagingTemplateService } from '../../messaging/messaging-template.service';
import { EMAIL_CAPABILITY } from 'src/domain/mail/email-template-type.const';
import { MESSAGING_CAPABILITY } from 'src/domain/messaging/messaging.const';
import { VERIFICATION_WHATSAPP_TEMPLATE_KEY } from 'src/domain/verification/verification-config.const';

export interface ChannelHealth {
  operational: boolean;
  reason?: string;
}

/** Checa o runtime operacional do canal via CapabilityRegistry e a disponibilidade do template de verificação. */
@Injectable()
export class CheckChannelHealthUseCase {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly templates: MessagingTemplateService,
    private readonly i18n: I18nService,
  ) {}

  async execute(channel: VerificationChannel): Promise<ChannelHealth> {
    if (channel === 'EMAIL') {
      const email = await this.capabilities.resolve(EMAIL_CAPABILITY, 'ADMIN');
      return email.operational
        ? { operational: true }
        : {
            operational: false,
            reason: email.reason,
          };
    }

    if (channel === 'WHATSAPP') {
      const messaging = await this.capabilities.resolve(
        MESSAGING_CAPABILITY,
        'ADMIN',
      );
      if (!messaging.operational) {
        return {
          operational: false,
          reason:
            messaging.reason ??
            this.i18n.t('verification.whatsapp_unavailable'),
        };
      }
      const ready = await this.templates.isUsable(
        VERIFICATION_WHATSAPP_TEMPLATE_KEY,
      );
      return ready
        ? { operational: true }
        : {
            operational: false,
            reason: this.i18n.t('verification.template_unavailable'),
          };
    }

    return {
      operational: false,
      reason: this.i18n.t('verification.channel_not_implemented'),
    };
  }
}
