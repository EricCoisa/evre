import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { SetUserConfigurationDto } from '../dto/set-user-configuration.dto';
import { LogActions } from 'src/domain/logging/log-actions';
import { validateValueType } from 'src/common/utils/conversor.util';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { maskIfSecret } from 'src/common/utils/mask-secret-for-log.util';

@Injectable()
export class SetUserConfigurationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute(
    userId: string,
    dto: SetUserConfigurationDto,
    performedById?: string,
  ) {
    const definition = await this.prisma.userConfigurationDefinition.findUnique(
      {
        where: { id: dto.definitionId },
      },
    );

    if (!definition) {
      throw new NotFoundException(
        this.i18n.t('user_configuration.definition_not_found'),
      );
    }

    // Validação básica de tipo
    validateValueType(dto.value, definition.valueType, this.i18n);

    // Criptografa o valor se a definição for secret
    const valueToStore =
      definition.secret && dto.value
        ? this.cryptoService.encryptString(dto.value)
        : dto.value;

    const config = await this.prisma.userConfiguration.upsert({
      where: {
        userId_definitionId: {
          userId,
          definitionId: dto.definitionId,
        },
      },
      create: {
        userId,
        definitionId: dto.definitionId,
        value: valueToStore,
      },
      update: {
        value: valueToStore,
      },
      include: { definition: true },
    });

    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION',
        action: LogActions.SET_CONFIGURATION,
        message: `Configuração definida: ${definition.labelKey}`,
        metadata: {
          userId,
          definitionId: dto.definitionId,
          value: maskIfSecret(definition.secret, dto.value),
        },
      },
      performedById || userId,
    );

    return config;
  }
}
