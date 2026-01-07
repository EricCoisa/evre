import { EmailProviderResponse, EmailResponse } from './email.response';

export interface IEmailProvider {
  onModuleInit(): Promise<void>;
  send(params: SendEmailParams): Promise<EmailResponse>;
  validateConfiguration(): Promise<EmailProviderResponse>;
}

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  text?: string | null;
  html?: string | null;
  from?: string;
};
