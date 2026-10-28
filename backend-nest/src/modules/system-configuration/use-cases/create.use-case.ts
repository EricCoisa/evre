import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { CreateSystemConfigurationDto } from '../dto/create-system-configuration.dto';
import { SystemConfiguration } from 'src/domain/system-configuration/system-configuration.entity';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { maskIfSecret } from 'src/common/utils/mask-secret-for-log.util';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import { configCacheKey } from 'src/domain/system-configuration/system-configuration.const';

@Injectable()
export class CreateSystemConfigurationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    // Ciclo via ClientLogService: sem forwardRef chega undefined.
    @Inject(forwardRef(() => LoggingService))
    private readonly loggingService: LoggingService,
    private readonly cryptoService: CryptoService,
    private readonly redis: RedisService,
  ) {}

  async execute(
    data: CreateSystemConfigurationDto,
    performedById: string,
  ): Promise<SystemConfiguration> {
    const existing = await this.prisma.systemConfiguration.findUnique({
      where: { labelKey: data.labelKey },
    });

    if (existing) {
      throw new ConflictException(
        this.i18n.t('system_configuration.labelkey_already_exists'),
      );
    }

    const createData = {
      ...data,
      value:
        data.secret === true && data.value
          ? this.cryptoService.encryptString(data.value)
          : data.value,
    };

    const config = await this.prisma.systemConfiguration.create({
      data: createData,
    });

    // Havia sentinela de "não existe" cacheada para esta chave.
    await this.redis.del(configCacheKey(config.labelKey));

    await this.loggingService.create(
      {
        module: 'SYSTEM_CONFIGURATION',
        action: LogActions.CREATE,
        message: `Configuração ${config.labelKey} criada`,
        metadata: {
          configId: config.id,
          labelKey: config.labelKey,
          valueType: config.valueType,
          value: maskIfSecret(config.secret, config.value),
        },
      },
      performedById,
    );

    const rawValue = config.secret
      ? this.cryptoService.tryDecrypt(config.value)
      : config.value;
    return {
      ...config,
      value: convertValueByType(rawValue, config.valueType) ?? rawValue,
    };
  }
}
