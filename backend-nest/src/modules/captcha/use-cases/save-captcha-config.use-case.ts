import { BadRequestException, Injectable } from '@nestjs/common';
import { assertProviderOk } from 'src/common/utils/provider-result.util';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { CaptchaService } from '../captcha.service';
import {
  CaptchaProviderIds,
  captchaConfigKeys,
  type CaptchaProviderId,
} from '../../../domain/auth/captcha.const';
import type { SaveCaptchaConfigDto } from '../dto/captcha.dto';

/** Valida as credenciais do captcha no provider e só então grava as chaves. */
@Injectable()
export class SaveCaptchaConfigUseCase {
  constructor(
    private readonly sysConfig: SystemConfigurationService,
    private readonly captcha: CaptchaService,
  ) {}

  async execute(dto: SaveCaptchaConfigDto, performedById: string) {
    if (!CaptchaProviderIds.includes(dto.provider as CaptchaProviderId)) {
      throw new BadRequestException(
        `Provider de captcha desconhecido: ${dto.provider}`,
      );
    }

    // Secret em branco = manter a gravada (o GET devolve `****`, nunca o valor).
    const secretKey = await this.sysConfig.keepStoredWhenBlank(
      dto.secretKey,
      captchaConfigKeys.secretKey,
    );
    if (!secretKey) {
      throw new BadRequestException('secretKey é obrigatória');
    }

    assertProviderOk(
      await this.captcha.validateConfiguration({
        provider: dto.provider as CaptchaProviderId,
        secretKey,
        token: dto.token,
      }),
    );

    await this.sysConfig.setManyByLabelKey(
      [
        {
          labelKey: captchaConfigKeys.provider,
          value: dto.provider,
          valueType: 'ENUM',
          options: [...CaptchaProviderIds],
        },
        { labelKey: captchaConfigKeys.siteKey, value: dto.siteKey },
        {
          labelKey: captchaConfigKeys.secretKey,
          value: secretKey,
          secret: true,
        },
      ],
      performedById,
    );

    return { status: true, data: 'Configuração salva' };
  }
}
