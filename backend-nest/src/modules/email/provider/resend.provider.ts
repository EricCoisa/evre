import { Injectable } from '@nestjs/common';
import { CreateEmailOptions, Resend } from 'resend';
import type {
  IEmailService,
  IEmailProvider,
  SendEmailParams,
} from 'src/domain/interface/email-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type { ResendConfigDto } from '../dto/resend-config.dto';

@Injectable()
export class ResendEmailService implements IEmailService<ResendConfigDto> {
  use(cfg: ResendConfigDto): IEmailProvider {
    const resend = new Resend(cfg.apiKey);
    return {
      send: (params) => this._send(resend, params),
      validateConfiguration: (from?) => this._validate(resend, from),
    };
  }

  private async _send(
    resend: Resend,
    params: SendEmailParams,
  ): Promise<ProviderResult> {
    try {
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

      const res = await resend.emails.send(payload);
      if (res.error) {
        return { status: false, data: res.error.message };
      }
      return { status: true, data: JSON.stringify(res) };
    } catch (error) {
      return {
        status: false,
        data: String((error as Error)?.message ?? error),
      };
    }
  }

  private async _validate(
    resend: Resend,
    from?: string,
  ): Promise<ProviderResult> {
    try {
      // Step 1: check API key — invalid key→validation_error, valid key→not_found (no email sent)
      const keyCheck = await resend.emails.get(
        '00000000-0000-0000-0000-000000000000',
      );
      const errName = (keyCheck.error as { name?: string } | undefined)?.name;
      if (keyCheck.error && errName !== 'not_found') {
        return { status: false, data: keyCheck.error.message };
      }

      // Step 2: check sender domain is verified in Resend
      if (from) {
        const domain = this.extractDomain(from);
        if (domain) {
          const domainsResult = await resend.domains.list();
          if (!domainsResult.error) {
            type DomainEntry = { name: string; status: string };
            const list =
              (domainsResult.data as { data?: DomainEntry[] })?.data ?? [];
            const verified = list.some(
              (d) => d.name === domain && d.status === 'verified',
            );
            if (!verified) {
              return {
                status: false,
                data: `Domínio "${domain}" não encontrado ou não verificado no Resend`,
              };
            }
          }
          // If domains.list() fails (restricted key), skip domain check — key was valid
        }
      }

      return { status: true, data: 'API key valid' };
    } catch (error) {
      return {
        status: false,
        data: String((error as Error)?.message ?? error),
      };
    }
  }

  private extractDomain(from: string): string {
    const match = from.match(
      /[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    );
    return match?.[1] ?? '';
  }
}
