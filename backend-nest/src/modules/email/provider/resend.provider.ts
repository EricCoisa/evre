import {
  IEmailProvider,
  SendEmailParams,
} from 'src/domain/interface/email-provider.interface';
import { CreateEmailOptions, Resend } from 'resend';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import {
  EmailProviderResponse,
  EmailResponse,
} from 'src/domain/interface/email.response';

export class ResendProvider implements IEmailProvider {
  private resend?: Resend;
  private apiKey?: string;

  constructor(
    private readonly systemConfigurationService: SystemConfigurationService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.resend) return;
    const apiKeyObj = await this.systemConfigurationService.findByLabelKey(
      'SYSTEM_EMAIL_PROVIDER_API_KEY',
    );
    this.apiKey = (apiKeyObj?.value as string) ?? process.env.RESEND_API_KEY;
    if (!this.apiKey) throw new Error('Resend API key not configured');
    this.resend = new Resend(this.apiKey);
  }

  async send(params: SendEmailParams): Promise<EmailResponse> {
    try {
      // Must provide either render content (html/text/react) or a template.
      if (!params.html && !params.text) {
        throw new Error(
          'Resend provider requires `html` or `text` when not using templates',
        );
      }

      const payload = {
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      } as CreateEmailOptions;

      const res = await this.resend!.emails.send(payload);
      if (res.error) {
        return { status: false, data: JSON.stringify(res.error) };
      }
      return { status: true, data: JSON.stringify(res) };
    } catch (error) {
      return { status: false, data: JSON.stringify(error) };
    }
  }

  async validateConfiguration(): Promise<EmailProviderResponse> {
    return await this.send({
      subject: 'Test Email from Resend Provider',
      to: 'delivered@resend.dev',
    });
  }
}
