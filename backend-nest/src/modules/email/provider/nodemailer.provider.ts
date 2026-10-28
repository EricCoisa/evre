import { Injectable } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import type {
  IEmailService,
  IEmailProvider,
  SendEmailParams,
} from 'src/domain/interface/email-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type { SmtpConfigDto } from '../dto/smtp-config.dto';

interface NodemailerSendResult {
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
}

@Injectable()
export class NodemailerEmailService implements IEmailService<SmtpConfigDto> {
  use(cfg: SmtpConfigDto): IEmailProvider {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    return {
      send: (params) => this._send(transporter, params),
      validateConfiguration: () => this._validate(transporter),
    };
  }

  private async _send(
    transporter: Transporter,
    params: SendEmailParams,
  ): Promise<ProviderResult> {
    const { to, subject, text, html, from } = params;

    if (!text && !html) {
      return { status: false, data: 'Email must have text or html content' };
    }

    try {
      const sendTo: string = Array.isArray(to) ? to.join(', ') : String(to);

      const info = (await transporter.sendMail({
        from: from ?? 'no-reply@system.local',
        to: sendTo,
        subject,
        text: text ?? undefined,
        html: html ?? undefined,
      })) as NodemailerSendResult;

      const messageId = info.messageId ?? '';
      const accepted = Array.isArray(info.accepted)
        ? info.accepted.map(String)
        : [];
      const rejected = Array.isArray(info.rejected)
        ? info.rejected.map(String)
        : [];

      return {
        status: true,
        data: JSON.stringify({ messageId, accepted, rejected }),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown email error';
      return { status: false, data: error };
    }
  }

  private async _validate(transporter: Transporter): Promise<ProviderResult> {
    try {
      await transporter.verify();
      return { status: true, data: 'SMTP OK' };
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      if (
        msg.includes('wrong version number') ||
        msg.includes('WRONG_VERSION_NUMBER')
      ) {
        return {
          status: false,
          data: 'Erro de TLS: porta 587 usa STARTTLS — mantenha "SMTP Seguro" como false. Para TLS implícito, use porta 465 com "SMTP Seguro" true.',
        };
      }
      return { status: false, data: msg };
    }
  }
}
