import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogClearTask } from '../../tasks/logClear.task';
import { LogActions } from 'src/domain/logging/log-actions';
import { UpdateSystemConfigurationDto } from '../dto/update-system-configuration.dto';
import { SystemConfiguration } from 'src/domain/system-configuration/system-configuration.entity';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import { maskIfSecret } from 'src/common/utils/mask-secret-for-log.util';
import { configCacheKey } from 'src/domain/system-configuration/system-configuration.const';
import { AI_HEALTH_KEY } from 'src/domain/ai/ai.const';

/** Prefixo de labelKey → health em cache a derrubar. */
const CACHE_INVALIDATIONS: Array<[prefix: string, key: string]> = [
  ['SYSTEM_EMAIL_', 'email:health'],
  ['SYSTEM_STORAGE_', 'storage:health'],
  ['SYSTEM_AI_', AI_HEALTH_KEY],
  ['SYSTEM_AGENT_', AI_HEALTH_KEY],
];

@Injectable()
export class UpdateSystemConfigurationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(forwardRef(() => LoggingService))
    private readonly loggingService: LoggingService,
    @Inject(forwardRef(() => LogClearTask))
    private readonly logClearTask: LogClearTask,
    private readonly cryptoService: CryptoService,
    private readonly redis: RedisService,
  ) {}

  async execute(
    id: string,
    updateDto: UpdateSystemConfigurationDto,
    performedById: string,
  ): Promise<SystemConfiguration> {
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

    if (updateDto.labelKey && updateDto.labelKey !== config.labelKey) {
      const existing = await this.prisma.systemConfiguration.findUnique({
        where: { labelKey: updateDto.labelKey },
      });

      if (existing) {
        throw new ConflictException(
          this.i18n.t('system_configuration.labelkey_already_exists'),
        );
      }
    }

    // `secret` não é editável por API — vale sempre a flag gravada.
    const shouldBeSecret = Boolean(config.secret);
    const updateData = {
      ...updateDto,
      value:
        updateDto.value && shouldBeSecret
          ? this.cryptoService.encryptString(updateDto.value)
          : updateDto.value,
    };

    const updatedConfig = await this.prisma.systemConfiguration.update({
      where: { id },
      data: updateData,
    });

    await this.loggingService.create(
      {
        module: 'SYSTEM_CONFIGURATION',
        action: LogActions.UPDATE,
        message: `Configuração ${updatedConfig.labelKey} atualizada para ${maskIfSecret(updatedConfig.secret, updatedConfig.value)}`,
        metadata: {
          configId: updatedConfig.id,
          labelKey: updatedConfig.labelKey,
          oldValue: maskIfSecret(config.secret, config.value),
          newValue: maskIfSecret(updatedConfig.secret, updatedConfig.value),
        },
      },
      performedById,
    );

    // labelKey pode ter sido renomeada.
    await this.redis.del(configCacheKey(config.labelKey));
    await this.redis.del(configCacheKey(updatedConfig.labelKey));

    for (const [prefix, key] of CACHE_INVALIDATIONS) {
      if (updatedConfig.labelKey.startsWith(prefix)) {
        await this.redis.del(key);
      }
    }
    void this.actionFire(updatedConfig);

    const rawValue = updatedConfig.secret
      ? this.cryptoService.tryDecrypt(updatedConfig.value)
      : updatedConfig.value;
    return {
      ...updatedConfig,
      value: convertValueByType(rawValue, updatedConfig.valueType) ?? rawValue,
    };
  }

  private async actionFire(updatedConfig: SystemConfiguration) {
    if (updatedConfig.labelKey === 'SYSTEMCONFIG_LOG_DELETE_DAY') {
      await this.logClearTask.updateCronSchedule();
    }
  }
}
