import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailProvider, EmailProviderConst } from 'src/domain/mail/mail.const';
import {
  EmailProviderResponse,
  EmailResponse,
} from 'src/domain/interface/email.response';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { ResendProvider } from 'src/modules/email/provider/resend.provider';
import { NodemailerProvider } from 'src/modules/email/provider/nodemailer.provider';
import { IEmailProvider } from 'src/domain/interface/email-provider.interface';

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfigurationService: SystemConfigurationService,
  ) {}

  async send(params: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
    performedById?: string | null;
  }): Promise<EmailResponse> {
    const { to, subject, performedById } = params;
    const provider = await this.GetProviderConfiguration();
    if (!provider) throw new Error('Provider not configured');

    if (params.from == null || params.from == undefined) {
      const fromConfig = await this.systemConfigurationService.findByLabelKey(
        'SYSTEM_EMAIL_DEFAULT_FROM',
      );
      params.from = fromConfig?.value as string;
    }

    try {
      // Instantiate the requested provider (default to RESEND)
      const providerInstance: IEmailProvider =
        this.GetProviderInstance(provider);
      // Ensure provider is initialized (providers implement onModuleInit)
      await providerInstance.onModuleInit();

      // Call send on provider
      const sendResult = await providerInstance.send({
        to,
        subject,
        text: params.text ?? null,
        html: params.html ?? null,
        from: params.from,
      });

      return sendResult;
    } catch (error) {
      const errorInfo = {
        message: (error as Error)?.message ?? String(error),
        name: (error as Error)?.name ?? undefined,
        stack: (error as Error)?.stack ?? undefined,
      };

      await this.prisma.systemLog.create({
        data: {
          module: 'SYSTEM',
          action: 'MAIL_SEND',
          message: 'Failed to send email',
          metadata: JSON.stringify({ data: errorInfo }),
          performedById: performedById ?? null,
        },
      });
      return { status: false, data: JSON.stringify(errorInfo) };
    }
  }

  async validateConfiguration(): Promise<EmailProviderResponse> {
    const provider = await this.GetProviderConfiguration();
    if (!provider) throw new Error('Provider not configured');
    const providerInstance: IEmailProvider = this.GetProviderInstance(provider);
    try {
      await providerInstance.onModuleInit();
      return await providerInstance.validateConfiguration();
    } catch {
      return { status: false, data: 'Provider initialization failed' };
    }
  }

  private async GetProviderConfiguration(): Promise<EmailProvider> {
    const providerConfig = await this.systemConfigurationService.findByLabelKey(
      'SYSTEM_EMAIL_PROVIDER',
    );

    if (!providerConfig) throw new Error('Provider not configured');
    return providerConfig?.value as EmailProvider;
  }

  private GetProviderInstance(provider: EmailProvider): IEmailProvider {
    switch (provider) {
      case EmailProviderConst.SMTP:
        return new NodemailerProvider(this.systemConfigurationService);
      case EmailProviderConst.RESEND:
      default:
        return new ResendProvider(this.systemConfigurationService);
    }
  }
}
