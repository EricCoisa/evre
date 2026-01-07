import {
  IEmailProvider,
  SendEmailParams,
} from 'src/domain/interface/email-provider.interface';
import nodemailer, { Transporter } from 'nodemailer';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import {
  EmailProviderResponse,
  EmailResponse,
} from 'src/domain/interface/email.response';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class NodemailerProvider implements IEmailProvider, OnModuleInit {
  private transporter!: Transporter<unknown>;

  constructor(
    private readonly systemConfigurationService: SystemConfigurationService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.transporter) return;

    const [hostObj, portObj, userObj, passObj, secureObj] = await Promise.all([
      this.systemConfigurationService.findByLabelKey('SYSTEM_EMAIL_SMTP_HOST'),
      this.systemConfigurationService.findByLabelKey('SYSTEM_EMAIL_SMTP_PORT'),
      this.systemConfigurationService.findByLabelKey('SYSTEM_EMAIL_SMTP_USER'),
      this.systemConfigurationService.findByLabelKey('SYSTEM_EMAIL_SMTP_PASS'),
      this.systemConfigurationService.findByLabelKey(
        'SYSTEM_EMAIL_SMTP_SECURE',
      ),
    ]);

    if (
      !hostObj?.value ||
      !portObj?.value ||
      !userObj?.value ||
      !passObj?.value
    ) {
      throw new Error('SMTP configuration is incomplete');
    }

    const port = Number(portObj.value);
    const secure = String(secureObj?.value as string).toLowerCase() === 'true';

    if (Number.isNaN(port)) {
      throw new Error('SMTP port must be a valid number');
    }

    this.transporter = nodemailer.createTransport({
      host: String(hostObj.value as string),
      port,
      secure,
      auth: {
        user: String(userObj.value as string),
        pass: String(passObj.value as string),
      },
    });

    await this.transporter.verify();
  }

  async send(params: SendEmailParams): Promise<EmailResponse> {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    const { to, subject, text, html, from } = params;

    if (!text && !html) {
      return {
        status: false,
        data: 'Email must have text or html content',
      };
    }

    try {
      const sendTo: string = Array.isArray(to) ? to.join(', ') : String(to);

      const info = await this.transporter.sendMail({
        from: from ?? 'no-reply@system.local',
        to: sendTo,
        subject,
        text: text ?? undefined,
        html: html ?? undefined,
      });

      // Type guards para garantir acesso seguro
      const messageId =
        typeof (info as { messageId?: unknown }).messageId === 'string'
          ? (info as { messageId: string }).messageId
          : '';
      const accepted = Array.isArray((info as { accepted?: unknown }).accepted)
        ? (info as { accepted: unknown[] }).accepted.map(String)
        : [];
      const rejected = Array.isArray((info as { rejected?: unknown }).rejected)
        ? (info as { rejected: unknown[] }).rejected.map(String)
        : [];

      return {
        status: true,
        data: JSON.stringify({
          messageId,
          accepted,
          rejected,
        }),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown email error';
      return {
        status: false,
        data: error,
      };
    }
  }

  async validateConfiguration(): Promise<EmailProviderResponse> {
    const result = await this.transporter.verify();
    return { status: true, data: JSON.stringify(result) };
  }
}
