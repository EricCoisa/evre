import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition } from 'src/domain/ai/ai-tool.types';
import { secretStatus } from 'src/domain/system-configuration/typed-config-keys.const';
import {
  EmailProviderConst,
  EMAIL_CONFIG_KEYS,
} from 'src/domain/mail/mail.const';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { CheckEmailHealthUseCase } from '../use-cases/check-health.use-case';

/** Retorna a configuração atual de email junto com a saúde do serviço. */
@AiToolDef()
@Injectable()
export class GetEmailConfigTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_email_config',
    description:
      'Retorna a configuração atual de email (provider RESEND ou SMTP, remetente padrão, host/porta/usuário no caso de SMTP) junto com a saúde do serviço. Credenciais NÃO são retornadas — apenas se estão configuradas ou não. Use para diagnosticar e-mail que não chega (convite, reset de senha).',
    inputSchema: z.object({}),
    roles: ['ADMIN'],
  };

  constructor(
    private readonly sysConfig: SystemConfigurationService,
    private readonly checkHealth: CheckEmailHealthUseCase,
  ) {}

  async execute() {
    const get = (key: string) => this.sysConfig.getValueOrNull(key);

    const provider = await get(EMAIL_CONFIG_KEYS.provider);
    const health = await this.checkHealth.execute();

    const base = {
      provider,
      health,
      defaultFrom: await get(EMAIL_CONFIG_KEYS.defaultFrom),
    };

    if (provider === EmailProviderConst.SMTP) {
      return {
        ...base,
        smtpHost: await get(EMAIL_CONFIG_KEYS.smtpHost),
        smtpPort: await get(EMAIL_CONFIG_KEYS.smtpPort),
        smtpUser: await get(EMAIL_CONFIG_KEYS.smtpUser),
        smtpSecure: await get(EMAIL_CONFIG_KEYS.smtpSecure),
        smtpPass: secretStatus(await get(EMAIL_CONFIG_KEYS.smtpPass)),
      };
    }

    return {
      ...base,
      apiKey: secretStatus(await get(EMAIL_CONFIG_KEYS.providerApiKey)),
    };
  }
}
