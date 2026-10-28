import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { maskIfSecret } from 'src/common/utils/mask-secret-for-log.util';

@Injectable()
export class RemoveUserConfigDefinitionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(id: string, performedById: string) {
    const config = await this.prisma.userConfigurationDefinition.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('user_configuration.definition_not_found'),
      );
    }

    await this.prisma.userConfigurationDefinition.delete({
      where: { id },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION_DEFINITION',
        action: LogActions.DELETE,
        message: `Configuração de usuário ${config.labelKey} removida`,
        metadata: {
          configId: config.id,
          labelKey: config.labelKey,
          valueType: config.valueType,
          value: maskIfSecret(config.secret, config.defaultValue),
        },
      },
      performedById,
    );

    return {
      status: true,
      message: this.i18n.t('user_configuration.definition_deleted'),
    };
  }
}
