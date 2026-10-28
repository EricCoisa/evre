import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition } from 'src/domain/ai/ai-tool.types';
import { captchaConfigKeys } from 'src/domain/auth/captcha.const';
import { secretStatus } from 'src/domain/system-configuration/typed-config-keys.const';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { CaptchaService } from '../captcha.service';

/** Retorna a configuração atual do captcha e o catálogo de providers suportados. */
@AiToolDef()
@Injectable()
export class GetCaptchaConfigTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_captcha_config',
    description:
      'Retorna a configuração atual do captcha (se está habilitado, provider escolhido, site key) e o catálogo de providers suportados com seus ids válidos. A secret key NÃO é retornada — apenas se está configurada. Chame antes de save_captcha_config para saber quais providers existem.',
    inputSchema: z.object({}),
    roles: ['ADMIN'],
  };

  constructor(
    private readonly sysConfig: SystemConfigurationService,
    private readonly captcha: CaptchaService,
  ) {}

  async execute() {
    const publicConfig = await this.captcha.publicConfig();

    return {
      ...publicConfig,
      secretKey: secretStatus(
        await this.sysConfig.getValueOrNull(captchaConfigKeys.secretKey),
      ),
      availableProviders: this.captcha.listProviders(),
    };
  }
}
