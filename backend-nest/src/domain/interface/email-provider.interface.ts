import type { ProviderResult } from 'src/domain/interface/provider-result';

export interface IEmailProvider {
  send(params: SendEmailParams): Promise<ProviderResult>;
  validateConfiguration(from?: string): Promise<ProviderResult>;
}

export interface IEmailService<IConfig> {
  use(config: IConfig): IEmailProvider;
}

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  text?: string | null;
  html?: string | null;
  from?: string;
};
