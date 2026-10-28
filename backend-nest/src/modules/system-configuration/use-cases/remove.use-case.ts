import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { maskIfSecret } from 'src/common/utils/mask-secret-for-log.util';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import { configCacheKey } from 'src/domain/system-configuration/system-configuration.const';

@Injectable()
export class RemoveSystemConfigurationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(forwardRef(() => LoggingService))
    private readonly loggingService: LoggingService,
    private readonly redis: RedisService,
  ) {}

  async execute(performedById: string, id: string) {
    const config = await this.prisma.systemConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    if (config.blocked) {
      throw new ForbiddenException(this.i18n.t('system_configuration.blocked'));
    }

    await this.prisma.systemConfiguration.delete({
      where: { id },
    });

    await this.redis.del(configCacheKey(config.labelKey));

    await this.loggingService.create(
      {
        module: 'SYSTEM_CONFIGURATION',
        action: LogActions.DELETE,
        message: `Configuração ${config.labelKey} removida`,
        metadata: {
          configId: config.id,
          labelKey: config.labelKey,
          valueType: config.valueType,
          value: maskIfSecret(config.secret, config.value),
        },
      },
      performedById,
    );

    return {
      status: true,
      message: this.i18n.t('system_configuration.deleted_successfully'),
    };
  }
}
