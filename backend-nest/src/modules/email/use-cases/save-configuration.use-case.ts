import { assertProviderOk } from 'src/common/utils/provider-result.util';
import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import type { EmailCandidateConfig } from '../email.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import {
  EmailProviderConst,
  EMAIL_CONFIG_KEYS,
} from 'src/domain/mail/mail.const';
import { ResendConfigDto } from '../dto/resend-config.dto';
import { SmtpConfigDto } from '../dto/smtp-config.dto';
import type { SaveEmailConfigDto } from '../dto/save-email-config.dto';

/** Valida o formulário de configuração de email contra o provider e só então persiste. */
@Injectable()
export class SaveEmailConfigurationUseCase {
  constructor(
    private readonly emailService: EmailService,
    private readonly sysConfig: SystemConfigurationService,
  ) {}

  async execute(dto: SaveEmailConfigDto, performedById: string) {
    const isSmtp = dto.provider === EmailProviderConst.SMTP;

    // Segredo em branco = manter o gravado (o GET devolve `****`, nunca o valor).
    const apiKey = await this.sysConfig.keepStoredWhenBlank(
      dto.apiKey,
      EMAIL_CONFIG_KEYS.providerApiKey,
    );
    const smtpPass = await this.sysConfig.keepStoredWhenBlank(
      dto.smtpPass,
      EMAIL_CONFIG_KEYS.smtpPass,
    );

    const candidate = this.buildCandidate(dto, isSmtp, apiKey, smtpPass);
    const result = await this.emailService.validateCandidate(candidate);
    assertProviderOk(result);

    await this.sysConfig.setManyByLabelKey(
      [
        {
          labelKey: EMAIL_CONFIG_KEYS.provider,
          value: dto.provider,
          valueType: 'ENUM',
          options: [EmailProviderConst.RESEND, EmailProviderConst.SMTP],
        },
        { labelKey: EMAIL_CONFIG_KEYS.defaultFrom, value: dto.defaultFrom },
        ...(isSmtp
          ? [
              {
                labelKey: EMAIL_CONFIG_KEYS.smtpHost,
                value: dto.smtpHost ?? '',
              },
              {
                labelKey: EMAIL_CONFIG_KEYS.smtpPort,
                value: String(dto.smtpPort ?? ''),
              },
              {
                labelKey: EMAIL_CONFIG_KEYS.smtpUser,
                value: dto.smtpUser ?? '',
              },
              {
                labelKey: EMAIL_CONFIG_KEYS.smtpPass,
                value: smtpPass,
                secret: true,
              },
              {
                labelKey: EMAIL_CONFIG_KEYS.smtpSecure,
                value: String(dto.smtpSecure ?? false),
                valueType: 'BOOLEAN' as const,
              },
            ]
          : [
              {
                labelKey: EMAIL_CONFIG_KEYS.providerApiKey,
                value: apiKey,
                secret: true,
              },
            ]),
      ],
      performedById,
    );

    // A saúde em cache descreve a configuração antiga — derruba para o próximo
    // /email/health refletir o que acabou de ser salvo.
    await this.emailService.invalidateHealthCache();

    return { status: true, data: 'Configuração salva' };
  }

  private buildCandidate(
    dto: SaveEmailConfigDto,
    isSmtp: boolean,
    apiKey: string,
    smtpPass: string,
  ): EmailCandidateConfig {
    if (isSmtp) {
      const smtp = new SmtpConfigDto();
      smtp.host = dto.smtpHost ?? '';
      smtp.port = dto.smtpPort ?? 587;
      smtp.user = dto.smtpUser ?? '';
      smtp.pass = smtpPass;
      smtp.secure = dto.smtpSecure ?? false;
      return { provider: 'SMTP', defaultFrom: dto.defaultFrom, smtp };
    }

    const resend = new ResendConfigDto();
    resend.apiKey = apiKey;
    return { provider: 'RESEND', defaultFrom: dto.defaultFrom, resend };
  }
}
