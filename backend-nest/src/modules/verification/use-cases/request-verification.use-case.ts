import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { VerificationChannel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { MessagingService } from '../../messaging/messaging.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { EmailTemplateType } from 'src/domain/mail/email-template-type.const';
import { VERIFICATION_WHATSAPP_TEMPLATE_KEY } from 'src/domain/verification/verification-config.const';
import {
  generateVerificationCode,
  hashVerificationCode,
} from '../verification.util';

const EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

export interface RequestVerificationInput {
  userId: string;
  /** Chave TS do módulo chamador (ex. UserVerificationPurpose.PHONE_CONFIRMATION). */
  purpose: string;
  channel: VerificationChannel;
  /** Só quando o destino ainda não está persistido no User; sem isto, resolve do email ou telefone já salvos. */
  target?: string;
}

export interface RequestVerificationOutput {
  expiresAt: Date;
}

/** Gera e despacha um código de verificação; diferente de notify(), nunca engole falha de envio. */
@Injectable()
export class RequestVerificationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly messagingService: MessagingService,
    private readonly loggingService: LoggingService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    input: RequestVerificationInput,
  ): Promise<RequestVerificationOutput> {
    const { userId, purpose, channel } = input;

    if (channel === 'AUTHENTICATOR') {
      throw new BadRequestException(
        this.i18n.t('verification.channel_not_implemented'),
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const target =
      input.target ?? (channel === 'EMAIL' ? user.email : user.phone);
    if (!target) {
      throw new BadRequestException(this.i18n.t('verification.no_target'));
    }

    const latest = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000
    ) {
      throw new BadRequestException(this.i18n.t('verification.cooldown'));
    }

    if (channel === 'EMAIL') {
      const health = await this.emailService.checkHealth();
      if (!health.operational) {
        throw new ServiceUnavailableException(
          this.i18n.t('verification.email_unavailable'),
        );
      }
    } else {
      const enabled = await this.messagingService.isEnabled();
      if (!enabled) {
        throw new ServiceUnavailableException(
          this.i18n.t('verification.whatsapp_unavailable'),
        );
      }
    }

    const code = generateVerificationCode();

    if (channel === 'EMAIL') {
      const html = await this.emailService.renderTemplate(
        EmailTemplateType.VERIFICATION_CODE,
        { name: user.name ?? user.email, code },
      );
      const result = await this.emailService.sendNow({
        to: target,
        subject: this.i18n.t('verification.email_subject'),
        html,
        performedById: userId,
      });
      if (!result.status) {
        throw new ServiceUnavailableException(
          this.i18n.t('verification.send_failed'),
        );
      }
    } else {
      await this.messagingService.sendTemplate(
        {
          key: VERIFICATION_WHATSAPP_TEMPLATE_KEY,
          phone: target,
          values: { code },
        },
        { userId },
      );
    }

    // Só persiste depois do envio ter sucesso: uma falha de despacho não deve gastar o cooldown
    // nem deixar uma linha órfã esperando um código que nunca chegou.
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);
    await this.prisma.verificationCode.create({
      data: {
        userId,
        purpose,
        channel,
        target,
        codeHash: hashVerificationCode(code),
        expiresAt,
      },
    });

    await this.loggingService.create(
      {
        module: 'VERIFICATION',
        action: LogActions.VERIFICATION_REQUESTED,
        message: `Código de verificação solicitado (purpose=${purpose}, channel=${channel})`,
        metadata: { userId, purpose, channel },
      },
      userId,
    );

    return { expiresAt };
  }
}
