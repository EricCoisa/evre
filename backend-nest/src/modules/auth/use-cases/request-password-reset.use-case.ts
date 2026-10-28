import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import { ShortUrlService } from '../../short-url/short-url.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { EmailTemplateType } from 'src/domain/mail/email-template-type.const';
import * as crypto from 'crypto';

/** Janela mínima entre dois e-mails de recuperação para o mesmo endereço. */
const RESET_EMAIL_COOLDOWN_SECONDS = 300;

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private loggingService: LoggingService,
    private i18n: I18nService,
    private systemConfigurationService: SystemConfigurationService,
    private redis: RedisService,
    private shortUrlService: ShortUrlService,
  ) {}

  async execute(email: string): Promise<void> {
    const health = await this.emailService.checkHealth();
    if (!health.operational) {
      throw new ServiceUnavailableException(
        this.i18n.t('auth.invite.email_service_unavailable'),
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Chave é o hash do e-mail, para o Redis não guardar PII; `setnx` falha aberto se o Redis estiver fora.
    const cooldownKey = `pwreset:cooldown:${crypto
      .createHash('sha256')
      .update(normalizedEmail)
      .digest('hex')}`;

    const firstInWindow = await this.redis.setnx(
      cooldownKey,
      '1',
      RESET_EMAIL_COOLDOWN_SECONDS,
    );

    if (!firstInWindow) {
      await this.loggingService.create(
        {
          module: 'AUTH',
          action: LogActions.PASSWORD_RESET_REQUEST,
          message: `Pedido de recuperação ignorado (janela de ${RESET_EMAIL_COOLDOWN_SECONDS}s) para ${normalizedEmail}`,
          metadata: { email: normalizedEmail, throttled: true },
        },
        null,
      );
      // Silencioso de propósito: o controller responde a mesma mensagem de sucesso
      // em todos os casos, e sinalizar aqui viraria enumeração de e-mail.
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      await this.loggingService.create(
        {
          module: 'AUTH',
          action: LogActions.PASSWORD_RESET_REQUEST,
          message: `Tentativa de recuperação de senha para email não cadastrado: ${normalizedEmail}`,
          metadata: { email: normalizedEmail, userFound: false },
        },
        null,
      );
      return;
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    await this.prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    const appUrl = process.env.NEXTAUTH_URL;
    const appName = (
      await this.systemConfigurationService.findByLabelKey('SYSTEM_APP_NAME')
    ).value;
    const originalActionUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const shortLink = await this.shortUrlService.shorten({
      targetUrl: originalActionUrl,
      expiresAt,
      purpose: 'PASSWORD_RESET',
      createdById: user.id,
    });
    const actionUrl = shortLink.shortUrl;

    const templateData = {
      name: user.name || user.email,
      organization: appName,
      message: `Você solicitou a recuperação de sua senha. Clique no botão abaixo para criar uma nova senha. O link expira em 30 minutos.`,
      action_url: actionUrl,
    };

    const html = await this.emailService.renderTemplate(
      EmailTemplateType.PASSWORD_RESET,
      templateData,
    );

    await this.emailService.send({
      subject: 'Recuperação de senha',
      to: user.email,
      html,
    });

    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.PASSWORD_RESET_REQUEST,
        message: `Solicitação de recuperação de senha para ${user.email}`,
        metadata: {
          userId: user.id,
          email: user.email,
          expiresAt: expiresAt.toISOString(),
        },
      },
      user.id,
    );
  }
}
