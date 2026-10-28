import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { SystemConfiguration } from 'src/domain/system-configuration/system-configuration.entity';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';

@Injectable()
export class FindOneSystemConfigurationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute(id: string): Promise<SystemConfiguration> {
    const config = await this.prisma.systemConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    const rawValue = config.secret
      ? this.cryptoService.tryDecrypt(config.value)
      : config.value;
    return {
      ...config,
      value: convertValueByType(rawValue, config.valueType) ?? rawValue,
    };
  }
}
