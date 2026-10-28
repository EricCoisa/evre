import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { UpdateUserConfigurationDefinitionsDto } from '../dto/update-user-configuration-definition.dto';
import { UserConfigurationDefinition } from 'src/domain/user-configuration-definition/user-configuration-definition.entity';
import { LogActions } from 'src/domain/logging/log-actions';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { maskIfSecret } from 'src/common/utils/mask-secret-for-log.util';

@Injectable()
export class UpdateUserConfigDefinitionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute(
    id: string,
    updateDto: UpdateUserConfigurationDefinitionsDto,
    performedById: string,
  ): Promise<UserConfigurationDefinition> {
    const config = await this.prisma.userConfigurationDefinition.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('user_configuration.definition_not_found'),
      );
    }

    if (updateDto.labelKey && updateDto.labelKey !== config.labelKey) {
      const existing = await this.prisma.userConfigurationDefinition.findUnique(
        {
          where: { labelKey: updateDto.labelKey },
        },
      );

      if (existing) {
        throw new ConflictException(
          this.i18n.t('user_configuration.definition_already_exists'),
        );
      }
    }

    const isSecret = updateDto.secret ?? config.secret;
    const updatedConfig = await this.prisma.userConfigurationDefinition.update({
      where: { id },
      data: {
        ...updateDto,
        ...(updateDto.defaultValue && isSecret
          ? {
              defaultValue: this.cryptoService.encryptString(
                updateDto.defaultValue,
              ),
            }
          : {}),
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION_DEFINITION',
        action: LogActions.UPDATE,
        message: `Configuração de usuário ${updatedConfig.labelKey} atualizada para ${maskIfSecret(updatedConfig.secret, updatedConfig.defaultValue)}`,
        metadata: {
          configId: updatedConfig.id,
          labelKey: updatedConfig.labelKey,
          oldValue: maskIfSecret(config.secret, config.defaultValue),
          newValue: maskIfSecret(
            updatedConfig.secret,
            updatedConfig.defaultValue,
          ),
        },
      },
      performedById,
    );

    return {
      ...updatedConfig,
      defaultValue:
        convertValueByType(
          updatedConfig.defaultValue,
          updatedConfig.valueType,
        ) ?? updatedConfig.defaultValue,
    };
  }
}
