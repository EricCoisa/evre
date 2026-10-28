import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { SetDefinitionDefaultDto } from '../dto/set-definition-default.dto';
import { LogActions } from 'src/domain/logging/log-actions';
import { validateValueType } from 'src/common/utils/conversor.util';
import { maskIfSecret } from 'src/common/utils/mask-secret-for-log.util';

/** Altera o `defaultValue` da definição — o valor herdado por quem não personalizou a chave. */
@Injectable()
export class SetDefinitionDefaultUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute(
    definitionId: string,
    dto: SetDefinitionDefaultDto,
    performedById: string,
  ) {
    const definition = await this.prisma.userConfigurationDefinition.findUnique(
      {
        where: { id: definitionId },
      },
    );

    if (!definition) {
      throw new NotFoundException(
        this.i18n.t('user_configuration.definition_not_found'),
      );
    }

    validateValueType(
      dto.defaultValue,
      definition.valueType,
      this.i18n,
      definition.options,
    );

    const updated = await this.prisma.userConfigurationDefinition.update({
      where: { id: definitionId },
      data: {
        defaultValue: definition.secret
          ? this.cryptoService.encryptString(dto.defaultValue)
          : dto.defaultValue,
      },
    });

    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION_DEFINITION',
        action: LogActions.SET_CONFIGURATION,
        message: `Default da definição alterado: ${definition.labelKey}`,
        metadata: {
          definitionId: definitionId,
          oldValue: maskIfSecret(definition.secret, definition.defaultValue),
          newValue: maskIfSecret(definition.secret, dto.defaultValue),
        },
      },
      performedById,
    );

    return updated;
  }
}
