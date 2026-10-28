import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EmailProviderConst,
  EMAIL_CONFIG_KEYS,
} from 'src/domain/mail/mail.const';
import {
  EMAIL_TEMPLATE_FILES,
  EMAIL_TEMPLATES_CONFIG_KEY,
  type EmailTemplateType,
} from 'src/domain/mail/email-template-type.const';
import {
  variablesFor,
  type EmailTemplateVariable,
} from 'src/domain/mail/email-variables.const';
import type { IEmailProvider } from 'src/domain/interface/email-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import { ResendEmailService } from './provider/resend.provider';
import { NodemailerEmailService } from './provider/nodemailer.provider';
import { ResendConfigDto } from './dto/resend-config.dto';
import { SmtpConfigDto } from './dto/smtp-config.dto';
import { renderTemplate } from 'src/common/utils/email.util';

const EMAIL_HEALTH_KEY = 'email:health';
const EMAIL_HEALTH_TTL = 300;

export interface EmailTemplateInfo {
  type: EmailTemplateType;
  /** HTML efetivo: a config, se houver; senão o arquivo de disco. */
  html: string;
  /** `true` quando não há override gravado — `html` é o default de disco. */
  isDefault: boolean;
  /** Conteúdo do arquivo de disco, sempre — é o que o "restaurar padrão" devolve. */
  defaultHtml: string;
  /** Variáveis aceitas por este tipo, vindas de `EMAIL_TEMPLATE_VARIABLES`. */
  variables: EmailTemplateVariable[];
}

/** Credenciais candidatas (ainda não gravadas) — ver `validateCandidate`. */
export type EmailCandidateConfig =
  | { provider: 'RESEND'; defaultFrom: string; resend: ResendConfigDto }
  | { provider: 'SMTP'; defaultFrom: string; smtp: SmtpConfigDto };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigurationService,
    private readonly resend: ResendEmailService,
    private readonly smtp: NodemailerEmailService,
    @Optional() @InjectQueue('email') private readonly emailQueue: Queue | null,
    private readonly redis: RedisService,
  ) {}

  async send(params: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
    performedById?: string | null;
  }): Promise<ProviderResult> {
    if (this.emailQueue) {
      await this.emailQueue.add('send', params, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
      // Returns optimistic ok so the HTTP path is non-blocking
      return { status: true, data: 'queued' };
    }

    this.logger.warn('EMAIL_QUEUE disabled: sending synchronously');
    return this.sendNow(params);
  }

  async checkHealth(): Promise<{ operational: boolean; reason?: string }> {
    const cached = await this.redis.get(EMAIL_HEALTH_KEY);
    if (cached !== null) {
      return JSON.parse(cached) as { operational: boolean; reason?: string };
    }
    const res = await this.validateConfiguration();
    const result: { operational: boolean; reason?: string } = {
      operational: res.status,
      ...(res.status ? {} : { reason: String(res.data) }),
    };
    await this.redis.set(
      EMAIL_HEALTH_KEY,
      JSON.stringify(result),
      EMAIL_HEALTH_TTL,
    );
    return result;
  }

  async invalidateHealthCache(): Promise<void> {
    await this.redis.del(EMAIL_HEALTH_KEY);
  }

  async validateConfiguration(): Promise<ProviderResult> {
    try {
      const from = await this.readConfigValue(EMAIL_CONFIG_KEYS.defaultFrom);
      return await (
        await this.provider()
      ).validateConfiguration(from ?? undefined);
    } catch (err) {
      return {
        status: false,
        data: String((err as Error)?.message ?? err),
      };
    }
  }

  /** Valida credenciais de email que ainda não estão gravadas. */
  async validateCandidate(
    candidate: EmailCandidateConfig,
  ): Promise<ProviderResult> {
    try {
      // Literal em vez de EmailProviderConst.SMTP: a const não é `as const`, então
      // o TS não estreita a união pelo discriminante se comparada com ela.
      const provider =
        candidate.provider === 'SMTP'
          ? this.smtp.use(candidate.smtp)
          : this.resend.use(candidate.resend);
      return await provider.validateConfiguration(candidate.defaultFrom);
    } catch (err) {
      return { status: false, data: String((err as Error)?.message ?? err) };
    }
  }

  /** Direct send — used by the queue processor and synchronous fallback. */
  async sendNow(params: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
    performedById?: string | null;
  }): Promise<ProviderResult> {
    const { to, subject, performedById } = params;

    if (params.from == null) {
      params.from =
        (await this.readConfigValue(EMAIL_CONFIG_KEYS.defaultFrom)) ??
        undefined;
    }

    try {
      const prov = await this.provider();
      const sendResult = await prov.send({
        to,
        subject,
        text: params.text ?? null,
        html: params.html ?? null,
        from: params.from,
      });

      if (sendResult.status === false) {
        await this.logMailFailure({ data: sendResult }, performedById ?? null);
      }

      return sendResult;
    } catch (error) {
      const errorInfo = {
        message: (error as Error)?.message ?? String(error),
        name: (error as Error)?.name ?? undefined,
        stack: (error as Error)?.stack ?? undefined,
      };

      await this.logMailFailure({ data: errorInfo }, performedById ?? null);
      return { status: false, data: errorInfo.message };
    }
  }

  /** Audita a falha de envio sem derrubar a operação que a originou. */
  private async logMailFailure(
    metadata: unknown,
    performedById: string | null,
  ): Promise<void> {
    try {
      await this.prisma.systemLog.create({
        data: {
          module: 'SYSTEM',
          action: 'MAIL_SEND',
          message: 'Failed to send email',
          metadata: JSON.stringify(metadata),
          performedById,
        },
      });
    } catch (logError) {
      this.logger.warn(
        `Falha ao registrar systemLog de envio de email (performedById=${performedById}): ${String(
          (logError as Error)?.message ?? logError,
        )}`,
      );
    }
  }

  /** Resolve o HTML do tipo (config ou disco) e interpola `vars` com escape. */
  async renderTemplate(
    type: EmailTemplateType,
    vars: Record<string, unknown>,
  ): Promise<string> {
    const html =
      (await this.readStoredTemplate(type)) ??
      (await this.readDefaultTemplateFile(type));
    return renderTemplate(html, vars, { escapeHtml: true });
  }

  /** HTML efetivo e default de disco de cada tipo editável. */
  async listTemplates(): Promise<EmailTemplateInfo[]> {
    const types = Object.keys(EMAIL_TEMPLATE_FILES) as EmailTemplateType[];
    return Promise.all(
      types.map(async (type) => {
        const stored = await this.readStoredTemplate(type);
        const defaultHtml = await this.readDefaultTemplateFile(type);
        return {
          type,
          html: stored ?? defaultHtml,
          isDefault: stored == null,
          defaultHtml,
          variables: variablesFor(type),
        };
      }),
    );
  }

  /** Override gravado para este tipo, ou `null`. */
  private async readStoredTemplate(
    type: EmailTemplateType,
  ): Promise<string | null> {
    const raw = await this.systemConfig.getValueOrNull(
      EMAIL_TEMPLATES_CONFIG_KEY,
    );
    if (!raw) return null;
    try {
      const map = JSON.parse(raw) as Record<string, string>;
      const html = map[type];
      return html?.trim() ? html : null;
    } catch {
      return null;
    }
  }

  private async readDefaultTemplateFile(
    type: EmailTemplateType,
  ): Promise<string> {
    const filePath = path.join(
      __dirname,
      'template',
      EMAIL_TEMPLATE_FILES[type],
    );
    return fs.readFile(filePath, 'utf8');
  }

  private async provider(): Promise<IEmailProvider> {
    const engine =
      (await this.readConfigValue(EMAIL_CONFIG_KEYS.provider)) ??
      EmailProviderConst.RESEND;

    switch (engine) {
      case EmailProviderConst.SMTP:
        return this.smtp.use(await this.readSmtpConfig());
      case EmailProviderConst.RESEND:
      default:
        return this.resend.use(await this.readResendConfig());
    }
  }

  private async readResendConfig(): Promise<ResendConfigDto> {
    const cfg = new ResendConfigDto();
    cfg.apiKey =
      (await this.readConfigValue(EMAIL_CONFIG_KEYS.providerApiKey)) ??
      process.env.RESEND_API_KEY ??
      '';
    return cfg;
  }

  private async readSmtpConfig(): Promise<SmtpConfigDto> {
    const cfg = new SmtpConfigDto();
    cfg.host =
      (await this.readConfigValue(EMAIL_CONFIG_KEYS.smtpHost)) ??
      process.env.SMTP_HOST ??
      '';
    cfg.port = Number(
      (await this.readConfigValue(EMAIL_CONFIG_KEYS.smtpPort)) ??
        process.env.SMTP_PORT ??
        '587',
    );
    cfg.user =
      (await this.readConfigValue(EMAIL_CONFIG_KEYS.smtpUser)) ??
      process.env.SMTP_USER ??
      '';
    cfg.pass =
      (await this.readConfigValue(EMAIL_CONFIG_KEYS.smtpPass)) ??
      process.env.SMTP_PASS ??
      '';
    cfg.secure =
      String(
        (await this.readConfigValue(EMAIL_CONFIG_KEYS.smtpSecure)) ??
          process.env.SMTP_SECURE ??
          'false',
      ).toLowerCase() === 'true';
    return cfg;
  }

  // findByLabelKey throws NotFoundException when key missing — catch and return null for graceful fallback
  private async readConfigValue(labelKey: string): Promise<string | null> {
    try {
      const record = await this.systemConfig.findByLabelKey(labelKey);
      return (record?.value as string) ?? null;
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }
}
