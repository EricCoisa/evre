import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';

@Injectable()
export class ResetUserConfigurationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(userId: string, definitionId: string, performedById?: string) {
    // Só o labelKey, para a mensagem do log. Ler direto evita depender do módulo
    // de definições só por isso — o CRUD do catálogo vive lá, não aqui.
    const definition = await this.prisma.userConfigurationDefinition.findUnique(
      { where: { id: definitionId }, select: { labelKey: true } },
    );
    if (!definition) {
      throw new NotFoundException(
        this.i18n.t('user_configuration.definition_not_found'),
      );
    }

    const existing = await this.prisma.userConfiguration.findUnique({
      where: {
        userId_definitionId: { userId, definitionId },
      },
    });

    if (existing) {
      await this.prisma.userConfiguration.delete({
        where: { id: existing.id },
      });

      await this.loggingService.create(
        {
          module: 'USER_CONFIGURATION',
          action: LogActions.RESET_CONFIGURATION,
          message: `Configuração resetada: ${definition.labelKey}`,
          metadata: { userId, definitionId },
        },
        performedById || userId,
      );
    }

    return {
      message: this.i18n.t('user_configuration.configuration_reset'),
    };
  }
}
